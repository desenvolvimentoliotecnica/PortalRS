# syntax=docker/dockerfile:1.7
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY LiotecnicaHub/LiotecnicaHub.Web/LiotecnicaHub.Web.csproj LiotecnicaHub/LiotecnicaHub.Web/
RUN --mount=type=cache,id=liotec-hub-nuget,target=/root/.nuget/packages \
    dotnet restore LiotecnicaHub/LiotecnicaHub.Web/LiotecnicaHub.Web.csproj

COPY . .
WORKDIR /src/LiotecnicaHub/LiotecnicaHub.Web
RUN --mount=type=cache,id=liotec-hub-nuget,target=/root/.nuget/packages \
    dotnet publish LiotecnicaHub.Web.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
RUN apt-get update && apt-get install -y --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:3010
EXPOSE 3010
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "LiotecnicaHub.Web.dll"]
