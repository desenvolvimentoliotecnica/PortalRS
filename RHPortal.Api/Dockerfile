FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project file and restore as distinct layers
COPY RHPortal.Api/RHPortal.Api/RHPortal.Api.csproj RHPortal.Api/RHPortal.Api/
RUN dotnet restore RHPortal.Api/RHPortal.Api/RHPortal.Api.csproj

# Copy everything else and build
COPY . .
WORKDIR /src/RHPortal.Api/RHPortal.Api
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "RHPortal.Api.dll"]
