FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY LioTecnica.sln ./
COPY LioTecnica.Web/*.csproj LioTecnica.Web/
COPY Liotecnica.Integration.RM.Schema/*.csproj Liotecnica.Integration.RM.Schema/
COPY Liotecnica.Integration.RM/*.csproj Liotecnica.Integration.RM/
RUN dotnet restore ./LioTecnica.sln

COPY . .
RUN dotnet publish LioTecnica.Web/LioTecnica.Web.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:80
EXPOSE 80
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "LioTecnica.Web.dll"]
