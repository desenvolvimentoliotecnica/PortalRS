# Introduction 
TODO: Give a short introduction of your project. Let this section explain the objectives or the motivation behind this project. 

# Getting Started

## Setup (rode uma vez ao clonar)

```bash
./setup-dev.sh
```

Isso configura os git hooks que bloqueiam commits sem migration EF criada.

## Regras obrigatórias

**Alterou uma entidade em `Domain/Entities/`? Crie a migration:**

```bash
cd RHPortal.Api/RHPortal.Api
dotnet ef migrations add NomeDaFeature --context AppDbContext
```

O commit será bloqueado automaticamente se você esquecer.

## Dependências
- .NET 9 SDK
- PostgreSQL
- `dotnet-ef` global: `dotnet tool install --global dotnet-ef`

# Build and Test
TODO: Describe and show how to build your code and run the tests. 

# Contribute
TODO: Explain how other users and developers can contribute to make your code better. 

If you want to learn more about creating good readme files then refer the following [guidelines](https://docs.microsoft.com/en-us/azure/devops/repos/git/create-a-readme?view=azure-devops). You can also seek inspiration from the below readme files:
- [ASP.NET Core](https://github.com/aspnet/Home)
- [Visual Studio Code](https://github.com/Microsoft/vscode)
- [Chakra Core](https://github.com/Microsoft/ChakraCore)