FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/DepoRet.Domain/*.csproj backend/DepoRet.Domain/
COPY backend/DepoRet.Application/*.csproj backend/DepoRet.Application/packages.lock.json backend/DepoRet.Application/
COPY backend/DepoRet.Infrastructure/*.csproj backend/DepoRet.Infrastructure/packages.lock.json backend/DepoRet.Infrastructure/
COPY backend/DepoRet.Api/*.csproj backend/DepoRet.Api/packages.lock.json backend/DepoRet.Api/
RUN dotnet restore backend/DepoRet.Api/DepoRet.Api.csproj --locked-mode
COPY backend/ backend/
RUN dotnet publish backend/DepoRet.Api/DepoRet.Api.csproj -c Release --no-restore -o /app
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "DepoRet.Api.dll"]

