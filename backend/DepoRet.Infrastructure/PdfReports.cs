using System.Globalization;
using System.Text.Json;
using System.Xml.Linq;
using DepoRet.Application;
using DepoRet.Domain;
using SkiaSharp;
namespace DepoRet.Infrastructure;

/// <summary>Vector PDF output with embedded fonts; no browser or external rendering service.</summary>
public sealed class PdfReports : IPdfReports
{
    private static readonly string Assets=Path.Combine(AppContext.BaseDirectory,"Assets");
    public byte[] Credit(CreditReport report,string document,string json)
    {
        using var data=JsonDocument.Parse(json);var root=data.RootElement;var sandbox=report.Mode=="Sandbox";
        using var sheet=new Sheet("Reporte de información crediticia");var c=sheet.Canvas;
        sheet.Equifax(38,32);sheet.Brand(432,34);
        sheet.Text("INFORMACIÓN CREDITICIA",38,93,20,true);
        sheet.Text(sandbox?"SANDBOX / REPORTE FICTICIO / SIN VALIDEZ CREDITICIA":"REPORTE GENERADO POR DEPORET / DATOS DEL PROVEEDOR",38,114,9,true,sandbox?"#B42355":"#475569");
        sheet.Line(38,130,557,130,"#EC008C",2);
        sheet.Text("EMISIÓN DEL DOCUMENTO",38,150,7,true,"#64748B");sheet.Text(DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5)).ToString("dd/MM/yyyy HH:mm:ss 'UTC-05:00'"),38,167,9);
        sheet.Text(report.DocumentType=="RUC"?"RUC CONSULTADO":"CÉDULA CONSULTADA",332,150,7,true,"#64748B");sheet.Text(document,332,167,11,true);
        sheet.Text("Consulta: "+report.Id,38,188,8);sheet.Text("Datos al: "+(report.CompletedAt??report.CreatedAt).ToOffset(TimeSpan.FromHours(-5)).ToString("dd/MM/yyyy HH:mm:ss"),38,205,8);
        sheet.Rect(38,224,519,154,"#F5F7FC",10);
        var score=root.TryGetProperty("score",out var sc)&&sc.TryGetInt32(out var sv)?sv:0;
        sheet.Text("SCORE CREDITICIO",54,247,8,true,"#64748B");sheet.Text(score.ToString(),54,304,45,true);sheet.Text("Escala referencial 1 - 999",55,326,8,false,"#64748B");
        var bands=new[]{("#E11D48","Alto",1,499),("#F59E0B","Medio",500,699),("#10B981","Bajo",700,999)};
        float bx=234,by=272,bw=300;foreach(var (color,label,from,to) in bands){var x=bx+(from-1)/998f*bw;var w=(to-from+1)/999f*bw;sheet.Rect(x,by,w,14,color,0);sheet.Text(label,x,by+33,8,true,color);sheet.Text($"{from} - {to}",x,by+47,7,false,"#64748B");}
        var pointer=bx+Math.Clamp((score-1)/998f,0,1)*bw;using(var paint=new SKPaint{Color=SKColor.Parse("#101B3C"),IsAntialias=true}){using var triangle=new SKPath();triangle.MoveTo(pointer,by-3);triangle.LineTo(pointer-5,by-11);triangle.LineTo(pointer+5,by-11);triangle.Close();c.DrawPath(triangle,paint);}
        sheet.Text(sandbox?"Riesgo de ejemplo: "+(score>=700?"BAJO":score>=500?"MEDIO":"ALTO"):"Bandas ilustrativas; consultar escala contractual.",234,350,8,true);
        sheet.Text("La escala visual no constituye una calificación oficial de Equifax.",54,365,7,false,"#64748B");
        sheet.Text("01   RESUMEN CONSOLIDADO",38,407,11,true);
        var summary=root.TryGetProperty("summary",out var sum)?sum:default;
        string Value(string key,bool money=true)=>summary.ValueKind==JsonValueKind.Object&&summary.TryGetProperty(key,out var v)&&v.TryGetDecimal(out var n)?(money?Usd(n):n.ToString("0",CultureInfo.InvariantCulture)):"No informado";
        var rows=new[]{new[]{"Obligaciones directas",Value("directObligations")},new[]{"Obligaciones indirectas",Value("indirectObligations")},new[]{"Deuda total reportada",Value("totalDebt")},new[]{"Saldo en mora",Value("overdue")}};
        sheet.Table(38,421,new[]{"Concepto","Valor USD"},rows,new[]{360f,159f},25);
        sheet.Text("02   DISTRIBUCIÓN POR ENTIDAD FINANCIERA",38,573,11,true);
        var entities=root.TryGetProperty("entities",out var es)?es:root.TryGetProperty("accounts",out var ac)?ac:default;
        var entityRows=new List<string[]>();if(entities.ValueKind==JsonValueKind.Array)foreach(var e in entities.EnumerateArray().Take(3))entityRows.Add(new[]{Str(e,"institution"),Str(e,"product"),Num(e,"direct","balance"),Num(e,"indirect"),Num(e,"overdue")});
        if(entityRows.Count==0)entityRows.Add(["Sin detalle informado","-","-","-","-"]);
        sheet.Table(38,587,["Entidad","Producto","Directa","Indirecta","Mora"],entityRows.ToArray(),[158,137,79,73,72],28);
        sheet.Text("03   MORA HISTÓRICA",38,735,11,true);
        sheet.Text(sandbox?"Historial ficticio: 0 días máximos de atraso en los últimos 12 meses.":"Detalle histórico no informado por el adaptador contratado.",38,754,8);
        sheet.Footer(sandbox?"Documento de demostración. No emitido por Equifax. No usar para aprobar créditos.":"Representación de DepoRet. No es un documento firmado o emitido oficialmente por Equifax.",1);
        sheet.EndPage();
        if(root.TryGetProperty("delinquency",out var history)&&history.ValueKind==JsonValueKind.Array){
            sheet.NewPage();sheet.Equifax(38,32);sheet.Brand(432,34);sheet.Text("DETALLE HISTÓRICO",38,100,20,true);
            sheet.Text(sandbox?"DATOS FICTICIOS DE SANDBOX":"INFORMACIÓN DEL PROVEEDOR",38,123,9,true,"#B42355");
            sheet.Text("Consulta: "+report.Id,38,149,8);sheet.Text(report.DocumentType+": "+document,38,168,9,true);
            var hs=history.EnumerateArray().Take(12).Select(h=>new[]{Str(h,"period"),Num(h,"d30"),Num(h,"d60"),Num(h,"d90"),Num(h,"d120")}).ToArray();
            sheet.Table(38,195,["Período","30 días","60 días","90 días","120+ días"],hs,[159,90,90,90,90],30);
            sheet.Text("LECTURA DEL REPORTE",38,650,11,true);
            sheet.Text("Los valores de mora se expresan en USD. Una ausencia de información no equivale",38,676,9);
            sheet.Text("a una deuda igual a cero. Las bandas de riesgo mostradas son referenciales.",38,694,9);
            sheet.Text("La consulta requiere autorización y se conserva en el historial del titular solicitante.",38,720,8,false,"#64748B");
            sheet.Footer(sandbox?"REPORTE FICTICIO. No procede de Equifax ni representa a una persona real.":"Representación de DepoRet con los datos disponibles del proveedor.",2);sheet.EndPage();
        }
        return sheet.Finish();
    }
    public byte[] Receipt(Payment p)
    {
        using var s=new Sheet("Constancia de operación DepoRet");s.Brand(38,32);s.Text("CONSTANCIA DE OPERACIÓN",38,112,21,true);
        s.Text(p.Simulated?"SANDBOX / SIN MOVIMIENTO REAL DE DINERO":"REGISTRO INTERNO DE LIQUIDACIÓN MANUAL",38,139,9,true,"#B42355");
        s.Line(38,156,557,156,"#EC008C",2);s.Text(p.Status,38,200,14,true);s.Text(Usd(p.Total)+" USD",38,250,32,true);
        s.Text("Operación: "+p.Id,38,285,9);s.Text("Fecha: "+p.CreatedAt.ToOffset(TimeSpan.FromHours(-5)).ToString("dd/MM/yyyy HH:mm:ss 'UTC-05:00'"),38,306,9);
        var rows=new[]{new[]{"Servicio",Catalog.Services.FirstOrDefault(x=>x.Id==p.Kind)?.Name??p.Kind},new[]{"Destinatario",p.Recipient},new[]{"Referencia solicitada",p.Reference},new[]{"Monto",Usd(p.Amount)},new[]{"Comisión",Usd(p.Fee)},new[]{"IVA sobre comisión",Usd(p.Tax)},new[]{"Referencia bancaria",p.ProviderReference??"Pendiente"},new[]{"Revisión",p.ReviewNote??"Pendiente"}};
        s.Table(38,338,["Concepto","Detalle"],rows,[180,339],37);s.Footer("Constancia interna sin validez tributaria. No sustituye una factura autorizada por el SRI.",1);s.EndPage();return s.Finish();
    }
    static string Str(JsonElement e,string key)=>e.TryGetProperty(key,out var v)&&v.ValueKind==JsonValueKind.String?v.GetString()??"-":"-";
    static string Num(JsonElement e,string key,string? alternative=null)=>e.TryGetProperty(key,out var v)&&v.TryGetDecimal(out var n)?Usd(n):alternative!=null?Num(e,alternative):"No informado";
    static string Usd(decimal n)=>"$"+n.ToString("N2",CultureInfo.InvariantCulture);

    private sealed class Sheet:IDisposable
    {
        readonly MemoryStream stream=new();readonly SKDocument doc;readonly SKTypeface regular,bold;public SKCanvas Canvas {get;private set;}=null!;
        public Sheet(string title){regular=SKTypeface.FromFile(Path.Combine(Assets,"Poppins-Regular.ttf"))??throw new InvalidOperationException("Missing PDF font");bold=SKTypeface.FromFile(Path.Combine(Assets,"Poppins-SemiBold.ttf"))??throw new InvalidOperationException("Missing PDF font");doc=SKDocument.CreatePdf(stream,new SKDocumentPdfMetadata{Title=title,Author="DepoRet",Creator="DepoRet / SkiaSharp",Subject="Información confidencial - acceso autorizado"});NewPage();}
        public void NewPage(){Canvas=doc.BeginPage(595,842);Canvas.Clear(SKColors.White);}
        public void EndPage()=>doc.EndPage();
        public void Text(string value,float x,float y,float size=10,bool strong=false,string color="#101B3C",float maxWidth=520){using var font=new SKFont(strong?bold:regular,size);using var paint=new SKPaint{Color=SKColor.Parse(color),IsAntialias=true};value=value.Replace('\n',' ').Replace('\r',' ');while(value.Length>1&&font.MeasureText(value)>maxWidth)value=value[..^2]+"…";Canvas.DrawText(value,x,y,font,paint);}
        public void Rect(float x,float y,float width,float height,string color,float radius){using var p=new SKPaint{Color=SKColor.Parse(color),IsAntialias=true};Canvas.DrawRoundRect(new SKRect(x,y,x+width,y+height),radius,radius,p);}
        public void Line(float x,float y,float x2,float y2,string color,float width=1){using var p=new SKPaint{Color=SKColor.Parse(color),StrokeWidth=width,IsAntialias=true};Canvas.DrawLine(x,y,x2,y2,p);}
        public void Table(float x,float y,string[] headings,string[][] rows,float[] widths,float rowHeight){Rect(x,y,widths.Sum(),rowHeight,"#101B3C",3);float px=x;for(var i=0;i<headings.Length;i++){Text(headings[i],px+10,y+rowHeight*.64f,8,true,"#FFFFFF",widths[i]-18);px+=widths[i];}y+=rowHeight;for(var r=0;r<rows.Length;r++){Rect(x,y,widths.Sum(),rowHeight,r%2==0?"#F5F7FC":"#FFFFFF",0);px=x;for(var i=0;i<widths.Length;i++){Text(rows[r][i],px+10,y+rowHeight*.64f,8,i==0,"#334155",widths[i]-18);px+=widths[i];}y+=rowHeight;}}
        public void Equifax(float x,float y){var svg=XDocument.Load(Path.Combine(Assets,"equifax.svg"));Canvas.Save();Canvas.Translate(x,y);using var p=new SKPaint{Color=SKColor.Parse("#9E1C33"),IsAntialias=true};foreach(var path in svg.Descendants().Where(n=>n.Name.LocalName=="path")){using var shape=SKPath.ParseSvgPathData(path.Attribute("d")!.Value);Canvas.DrawPath(shape,p);}foreach(var polygon in svg.Descendants().Where(n=>n.Name.LocalName=="polygon")){var values=System.Text.RegularExpressions.Regex.Matches(polygon.Attribute("points")!.Value,@"-?\d+(?:\.\d+)?").Select(m=>float.Parse(m.Value,CultureInfo.InvariantCulture)).ToArray();using var shape=new SKPath();for(var i=0;i<values.Length;i+=2){if(i==0)shape.MoveTo(values[i],values[i+1]);else shape.LineTo(values[i],values[i+1]);}shape.Close();Canvas.DrawPath(shape,p);}Canvas.Restore();}
        public void Brand(float x,float y){Canvas.Save();Canvas.Translate(x,y);Canvas.Scale(.55f);using var pink=new SKPaint{Color=SKColor.Parse("#EC008C"),IsAntialias=true};using var black=new SKPaint{Color=SKColor.Parse("#080808"),IsAntialias=true};using var d=SKPath.ParseSvgPathData("M20 5Q20 2 24 2H36C53 2 62 13 62 29C62 47 52 60 34 60H19L24 46H34C44 46 48 39 48 30C48 21 44 16 34 16H17Z");Canvas.DrawPath(d,pink);using var bottom=SKPath.ParseSvgPathData("M62 28C62 46 51 47 34 47H24L19 60H34C52 60 62 47 62 28Z");Canvas.DrawPath(bottom,black);using var arrow=SKPath.ParseSvgPathData("M1 34L18 19L30 35H23L19 48Q16 57 23 60H14Q1 60 5 46L8 34Z");Canvas.DrawPath(arrow,pink);Canvas.Restore();Text("Depo",x+40,y+24,16,true,"#080808");Text("Ret",x+84,y+24,16,true,"#EC008C");}
        public void Footer(string message,int page){Line(38,787,557,787,"#E2E8F0");Text(message,38,805,7,false,"#64748B");Text("Confidencial / USD / Ecuador",38,821,7,false,"#64748B");Text(page.ToString(),545,821,8,true);}
        public byte[] Finish(){doc.Close();return stream.ToArray();}
        public void Dispose(){doc.Dispose();regular.Dispose();bold.Dispose();stream.Dispose();}
    }
}
