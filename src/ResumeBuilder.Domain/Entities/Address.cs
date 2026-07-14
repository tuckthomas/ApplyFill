namespace ResumeBuilder.Domain.Entities;

public class Address
{
    public Guid Id { get; set; }
    public string? StreetAddressLine1 { get; set; }
    public string? StreetAddressLine2 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? PostalCode { get; set; }
    public string? Country { get; set; }
}
