FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project file and restore as distinct layers
# Note: project is nested at RHPortal.Api/RHPortal.Api/RHPortal.Api.csproj
COPY RHPortal.Api/RHPortal.Api/RHPortal.Api.csproj RHPortal.Api/RHPortal.Api/
RUN dotnet restore RHPortal.Api/RHPortal.Api/RHPortal.Api.csproj

# Copy everything else and build
COPY . .
WORKDIR /src/RHPortal.Api/RHPortal.Api
RUN dotnet publish RHPortal.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
RUN apt-get update && apt-get install -y --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:80
EXPOSE 80
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "RHPortal.Api.dll"]
