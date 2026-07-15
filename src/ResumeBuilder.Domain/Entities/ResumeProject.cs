using System.ComponentModel.DataAnnotations.Schema;
using ResumeBuilder.Domain.Enums;

namespace ResumeBuilder.Domain.Entities;

public class ResumeProject
{
    public Guid Id { get; set; }
    public Guid ResumeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ProjectType { get; set; }
    public string? Role { get; set; }
    public string? Organization { get; set; }
    public string? ProjectUrl { get; set; }
    public DateTime? StartDate { get; set; }
    public EmploymentDatePrecision StartDatePrecision { get; set; } = EmploymentDatePrecision.Exact;
    public DateTime? EndDate { get; set; }
    public EmploymentDatePrecision EndDatePrecision { get; set; } = EmploymentDatePrecision.Exact;
    public bool IsOngoing { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }

    public Resume Resume { get; set; } = null!;

    [NotMapped]
    public DateTime? StartDateForAutofill => ResolveForAutofill(StartDate, StartDatePrecision, isStartDate: true);

    [NotMapped]
    public DateTime? EndDateForAutofill => IsOngoing
        ? null
        : ResolveForAutofill(EndDate, EndDatePrecision, isStartDate: false);

    private static DateTime? ResolveForAutofill(
        DateTime? value,
        EmploymentDatePrecision precision,
        bool isStartDate)
    {
        if (!value.HasValue)
        {
            return null;
        }

        if (precision == EmploymentDatePrecision.Exact)
        {
            return value.Value.Date;
        }

        var date = value.Value;
        var day = isStartDate ? 1 : DateTime.DaysInMonth(date.Year, date.Month);
        return new DateTime(date.Year, date.Month, day, 0, 0, 0, date.Kind);
    }
}
