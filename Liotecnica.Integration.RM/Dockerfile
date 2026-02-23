FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY Liotecnica.Integration.RM/*.csproj Liotecnica.Integration.RM/
COPY Liotecnica.Integration.RM.Schema/*.csproj Liotecnica.Integration.RM.Schema/
RUN dotnet restore Liotecnica.Integration.RM/Liotecnica.Integration.RM.csproj

COPY . .
RUN dotnet publish Liotecnica.Integration.RM/Liotecnica.Integration.RM.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/runtime:8.0 AS final
WORKDIR /app

COPY --from=build /app/publish ./

ENTRYPOINT ["dotnet", "Liotecnica.Integration.RM.dll"]
