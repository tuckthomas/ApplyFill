using System.ComponentModel.DataAnnotations.Schema;
using ResumeBuilder.Domain.Enums;

namespace ResumeBuilder.Domain.Entities;

public class ResumeExperience
{
    public Guid Id { get; set; }
    public Guid ResumeId { get; set; }
    public string Company { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public Guid? AddressId { get; set; }
    public Address? Address { get; set; }
    public string? PhoneNumber { get; set; }
    public string? SupervisorName { get; set; }
    public bool MayContactSupervisor { get; set; }
    public DateTime? StartDate { get; set; }
    public EmploymentDatePrecision StartDatePrecision { get; set; } = EmploymentDatePrecision.Exact;
    public DateTime? EndDate { get; set; }
    public EmploymentDatePrecision EndDatePrecision { get; set; } = EmploymentDatePrecision.Exact;
    public bool IsCurrent { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }

    public Resume Resume { get; set; } = null!;
    public ICollection<ResumeBullet> Bullets { get; set; } = new List<ResumeBullet>();

    [NotMapped]
    public DateTime? StartDateForAutofill => ResolveForAutofill(StartDate, StartDatePrecision, isStartDate: true);

    [NotMapped]
    public DateTime? EndDateForAutofill => IsCurrent
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
