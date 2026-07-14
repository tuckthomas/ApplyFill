using System.ComponentModel.DataAnnotations.Schema;
using ResumeBuilder.Domain.Enums;

namespace ResumeBuilder.Domain.Entities;

public class ResumeEducation
{
    public Guid Id { get; set; }
    public Guid ResumeId { get; set; }
    public string School { get; set; } = string.Empty;
    public string Degree { get; set; } = string.Empty;
    public string? FieldOfStudy { get; set; }
    public string? Country { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public bool IsRemote { get; set; }
    public bool IsCurrentlyEnrolled { get; set; }
    public DateTime? StartDate { get; set; }
    public EmploymentDatePrecision StartDatePrecision { get; set; } = EmploymentDatePrecision.Exact;
    public DateTime? EndDate { get; set; }
    public EmploymentDatePrecision EndDatePrecision { get; set; } = EmploymentDatePrecision.Exact;
    public string? AdditionalDetails { get; set; }
    public int SortOrder { get; set; }

    public Resume Resume { get; set; } = null!;

    [NotMapped]
    public DateTime? StartDateForAutofill => ResolveForAutofill(StartDate, StartDatePrecision, isStartDate: true);

    [NotMapped]
    public DateTime? EndDateForAutofill => IsCurrentlyEnrolled
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
