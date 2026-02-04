# ====== build ======
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Restaura pelo .sln para cache decente
COPY LioTecnica.sln ./
COPY LioTecnica.Web/*.csproj LioTecnica.Web/
RUN dotnet restore ./LioTecnica.sln

# Copia tudo e publica
COPY . .
RUN dotnet publish LioTecnica.Web/LioTecnica.Web.csproj -c Release -o /out /p:UseAppHost=false

# ====== runtime ======
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

COPY --from=build /out .

ENV ASPNETCORE_ENVIRONMENT=Production

CMD ["dotnet","LioTecnica.Web.dll"]
