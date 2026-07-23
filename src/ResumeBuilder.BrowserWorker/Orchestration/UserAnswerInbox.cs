using System.Collections.Concurrent;

namespace ResumeBuilder.BrowserWorker.Orchestration;

public sealed record UserAnswer(
    Guid RunId,
    string QuestionId,
    string ControlId,
    string Field,
    string Value,
    DateTimeOffset AnsweredAt);

public interface IUserAnswerInbox
{
    void Put(UserAnswer answer);
    bool TryGet(Guid runId, out UserAnswer? answer);
    void Remove(Guid runId);
}

public sealed class InMemoryUserAnswerInbox : IUserAnswerInbox
{
    private readonly ConcurrentDictionary<Guid, UserAnswer> _answers = new();

    public void Put(UserAnswer answer) => _answers[answer.RunId] = answer;
    public bool TryGet(Guid runId, out UserAnswer? answer) => _answers.TryGetValue(runId, out answer);
    public void Remove(Guid runId) => _answers.TryRemove(runId, out _);
}
