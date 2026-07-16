namespace ResumeBuilder.Domain;

public static class ProfileConsentTerms
{
    public const string ConsentType = "ProfileDataUseForApplicationAutomation";
    public const string DisclosureVersion = "profile-automation-v1";
    public const string CaptureMethod = "ProfileWizardCheckboxAndButton";
    public const string DisclosureText = "Job applications commonly request information that does not belong on a resume, including full addresses, alternative names, supervisor details, reasons for leaving, work dates, and voluntary demographic responses. Saving those details here prevents repeated entry when an application asks for them.\n\n"
        + "You may leave any field or entire section blank. A blank field will not appear on a generated resume and will not be used to autofill a job application. ApplyFill will not invent a missing answer.\n\n"
        + "People who want agentic job-application assistance benefit most from completing the fields commonly required by employers. More complete source data allows automation to fill more of an average application while leaving unanswered fields for your review.\n\n"
        + "Agentic application-filling features are under development. The profile collected now provides the structured data those workflows will use.\n\n"
        + "When you consent, ApplyFill records your authenticated profile, the disclosure version and text, UTC date and time, capture method, IP address, browser details, and a cryptographic hash of the disclosure for audit purposes.";
}
