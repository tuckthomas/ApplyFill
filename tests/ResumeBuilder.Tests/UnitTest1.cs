using ResumeBuilder.Domain.Entities;
using ResumeBuilder.Domain.Enums;

namespace ResumeBuilder.Tests;

public class UnitTest1
{
    [Fact]
    public void EstimatedEmploymentDatesResolveToMonthBoundariesForAutofill()
    {
        var experience = new ResumeExperience
        {
            StartDate = new DateTime(2022, 3, 15),
            StartDatePrecision = EmploymentDatePrecision.Estimated,
            EndDate = new DateTime(2024, 2, 3),
            EndDatePrecision = EmploymentDatePrecision.Estimated
        };

        Assert.Equal(new DateTime(2022, 3, 1), experience.StartDateForAutofill);
        Assert.Equal(new DateTime(2024, 2, 29), experience.EndDateForAutofill);
    }

    [Fact]
    public void ExactEmploymentDatesStayExactForAutofill()
    {
        var experience = new ResumeExperience
        {
            StartDate = new DateTime(2022, 3, 15),
            StartDatePrecision = EmploymentDatePrecision.Exact,
            EndDate = new DateTime(2024, 2, 3),
            EndDatePrecision = EmploymentDatePrecision.Exact
        };

        Assert.Equal(new DateTime(2022, 3, 15), experience.StartDateForAutofill);
        Assert.Equal(new DateTime(2024, 2, 3), experience.EndDateForAutofill);
    }

    [Fact]
    public void CurrentEmploymentOmitsEndDateForAutofill()
    {
        var experience = new ResumeExperience
        {
            IsCurrent = true,
            EndDate = new DateTime(2024, 2, 3),
            EndDatePrecision = EmploymentDatePrecision.Estimated
        };

        Assert.Null(experience.EndDateForAutofill);
    }

    [Fact]
    public void EstimatedEducationDatesResolveToMonthBoundariesForAutofill()
    {
        var education = new ResumeEducation
        {
            StartDate = new DateTime(2010, 8, 9),
            StartDatePrecision = EmploymentDatePrecision.Estimated,
            EndDate = new DateTime(2014, 5, 2),
            EndDatePrecision = EmploymentDatePrecision.Estimated
        };

        Assert.Equal(new DateTime(2010, 8, 1), education.StartDateForAutofill);
        Assert.Equal(new DateTime(2014, 5, 31), education.EndDateForAutofill);
    }

    [Fact]
    public void CurrentEducationOmitsEndDateForAutofill()
    {
        var education = new ResumeEducation
        {
            IsCurrentlyEnrolled = true,
            EndDate = new DateTime(2026, 5, 1),
            EndDatePrecision = EmploymentDatePrecision.Estimated
        };

        Assert.Null(education.EndDateForAutofill);
    }
}
