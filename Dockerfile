# ====== build ======
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Restaura pelo .sln para cache decente
COPY LioTecnica.sln ./
COPY LioTecnica.Web/*.csproj LioTecnica.Web/
COPY Liotecnica.Integration.RM.Schema/*.csproj Liotecnica.Integration.RM.Schema/
COPY Liotecnica.Integration.RM/*.csproj Liotecnica.Integration.RM/
RUN dotnet restore ./LioTecnica.sln

# Copia tudo e publica
COPY . .
RUN dotnet publish LioTecnica.Web/LioTecnica.Web.csproj -c Release -o /out /p:UseAppHost=false

# ====== runtime ======
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

COPY --from=build /out .

ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:80
EXPOSE 80
CMD ["dotnet", "LioTecnica.Web.dll"]
