using RhPortal.Api.Application.Common;
using RhPortal.Api.Domain.Entities;
using Xunit;

namespace RhPortal.Api.Tests.Application.Common;

public sealed class TurnoEscalaTrabalhoRawMapperTests
{
    [Fact]
    public void HasPopulatedGrid_false_for_plain_text()
    {
        Assert.False(TurnoEscalaTrabalhoRawMapper.HasPopulatedGrid("Comercial 8h-18h"));
    }

    [Fact]
    public void HasPopulatedGrid_true_when_cell_filled()
    {
        const string json = """{"escala":"","grid":{"entrada":{"seg":"08:00","ter":"","qua":"","qui":"","sex":"","sab":"","dom":""},"intInicio":{"seg":"","ter":"","qua":"","qui":"","sex":"","sab":"","dom":""},"intTermino":{"seg":"","ter":"","qua":"","qui":"","sex":"","sab":"","dom":""},"saida":{"seg":"","ter":"","qua":"","qui":"","sex":"","sab":"","dom":""}}}""";
        Assert.True(TurnoEscalaTrabalhoRawMapper.HasPopulatedGrid(json));
    }

    [Fact]
    public void ResolveFromTurno_prefers_grade_json()
    {
        const string grade = """{"escala":"2ª a 6ª","grid":{"entrada":{"seg":"09:00","ter":"09:00","qua":"09:00","qui":"09:00","sex":"09:00","sab":"","dom":""},"intInicio":{"seg":"12:00","ter":"12:00","qua":"12:00","qui":"12:00","sex":"12:00","sab":"","dom":""},"intTermino":{"seg":"13:00","ter":"13:00","qua":"13:00","qui":"13:00","sex":"13:00","sab":"","dom":""},"saida":{"seg":"18:00","ter":"18:00","qua":"18:00","qui":"18:00","sex":"18:00","sab":"","dom":""}}}""";
        var turno = new Turno
        {
            Id = Guid.NewGuid(),
            TenantId = "t",
            Code = "ADM",
            Description = "Admin",
            GradeHorarioJson = grade,
            StartTime = "07:00",
            EndTime = "19:00",
        };
        var r = TurnoEscalaTrabalhoRawMapper.ResolveFromTurno(turno);
        Assert.Equal(grade, r);
    }

    [Fact]
    public void ResolveFromTurno_builds_from_start_end_when_no_grade()
    {
        var turno = new Turno
        {
            Id = Guid.NewGuid(),
            TenantId = "t",
            Code = "C1",
            Description = "Comercial",
            GradeHorarioJson = null,
            StartTime = "08:00",
            EndTime = "18:00",
        };
        var r = TurnoEscalaTrabalhoRawMapper.ResolveFromTurno(turno);
        Assert.NotNull(r);
        Assert.True(TurnoEscalaTrabalhoRawMapper.HasPopulatedGrid(r));
        Assert.Contains("\"seg\":\"08:00\"", r);
        Assert.Contains("\"seg\":\"18:00\"", r);
    }

    [Fact]
    public void ResolveForNewVaga_ignores_plain_solic_text_when_turno_has_times()
    {
        var turno = new Turno
        {
            Id = Guid.NewGuid(),
            TenantId = "t",
            Code = "X",
            Description = "X",
            StartTime = "08:00",
            EndTime = "17:00",
        };
        var r = TurnoEscalaTrabalhoRawMapper.ResolveForNewVaga("Texto livre da solicitação", turno);
        Assert.NotNull(r);
        Assert.True(TurnoEscalaTrabalhoRawMapper.HasPopulatedGrid(r!));
        Assert.Contains("17:00", r);
    }

    [Fact]
    public void ResolveForNewVaga_accepts_valid_json_from_solic_when_no_turno()
    {
        const string json = """{"escala":"","grid":{"entrada":{"seg":"10:00","ter":"","qua":"","qui":"","sex":"","sab":"","dom":""},"intInicio":{"seg":"","ter":"","qua":"","qui":"","sex":"","sab":"","dom":""},"intTermino":{"seg":"","ter":"","qua":"","qui":"","sex":"","sab":"","dom":""},"saida":{"seg":"","ter":"","qua":"","qui":"","sex":"","sab":"","dom":""}}}""";
        var r = TurnoEscalaTrabalhoRawMapper.ResolveForNewVaga(json, null);
        Assert.Equal(json, r);
    }
}
