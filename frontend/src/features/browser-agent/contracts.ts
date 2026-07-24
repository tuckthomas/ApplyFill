export type BrowserRunState =
  | 'ready'
  | 'agent-running'
  | 'pausing'
  | 'paused'
  | 'user-control'
  | 'waiting-for-user'
  | 'recovering'
  | 'ready-for-review'
  | 'submitting'
  | 'stopped'
  | 'completed'
  | 'failed';

export type BrowserControlOwner = 'agent' | 'user' | 'none';

export type BrowserConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export type BrowserAgentActivity = {
  id: string;
  occurredAt: string;
  summary: string;
  detail?: string;
  kind: 'completed' | 'current' | 'question' | 'warning' | 'error';
};

export type BrowserAgentQuestionOption = {
  id: string;
  label: string;
  description?: string;
};

export type BrowserAgentQuestion = {
  id: string;
  prompt: string;
  context: string;
  category: 'login' | 'mfa' | 'captcha' | 'sensitive' | 'sensitive-approval' | 'legal' | 'choice' | 'unsupported';
  options?: BrowserAgentQuestionOption[];
  allowFreeText?: boolean;
  canSaveToProfile?: boolean;
  approvalId?: string;
  approvalConcurrencyToken?: string;
  maskedValue?: string;
};

export type BrowserRunReview = {
  sectionsAnswered: string[];
  resumeName?: string;
  coverLetterName?: string;
  sensitiveDisclosures: string[];
  userModifiedFields: string[];
  unresolvedWarnings: string[];
  approvalRecorded: boolean;
};

export type BrowserRunSnapshot = {
  id: string;
  revision: number;
  state: BrowserRunState;
  controlOwner: BrowserControlOwner;
  companyName?: string;
  jobTitle?: string;
  currentUrl: string;
  currentDomain: string;
  applicationStage: string;
  statusMessage: string;
  controlReason?: string;
  currentAction?: string;
  updatedAt: string;
  frameUpdatedAt?: string;
  frameWidth?: number;
  frameHeight?: number;
  frameSequence?: number;
  framePageGeneration?: number;
  frameDeviceScaleFactor?: number;
  frameUrl?: string;
  pendingQuestion?: BrowserAgentQuestion;
  activity: BrowserAgentActivity[];
  review?: BrowserRunReview;
  canResume: boolean;
  checkpointRetained: boolean;
};

export type BrowserRunSummary = Pick<BrowserRunSnapshot,
  'id' | 'state' | 'companyName' | 'jobTitle' | 'currentDomain' | 'applicationStage' | 'updatedAt' | 'canResume'>;

export type StartBrowserRunRequest = {
  companyName?: string;
  credentialId?: string;
  jobApplicationId?: string;
  jobTitle?: string;
  profileId: string;
  resumeId?: string;
  targetUrl: string;
};

export type BrowserRunCommand =
  | 'pause'
  | 'resume'
  | 'take-control'
  | 'return-control'
  | 'stop'
  | 'approve-submit';

type FrameBoundInput = { frameSequence: number; pageGeneration: number };

export type BrowserInput = FrameBoundInput & (
  | { kind: 'pointer'; event: 'move' | 'down' | 'up'; x: number; y: number; button?: number }
  | { kind: 'wheel'; deltaX: number; deltaY: number; x: number; y: number }
  | { kind: 'key'; event: 'down' | 'up'; key: string; code: string; alt: boolean; control: boolean; meta: boolean; shift: boolean }
  | { kind: 'resize'; viewportWidth: number; viewportHeight: number }
);

export type BrowserAgentQuestionAnswer = {
  optionId?: string;
  value?: string;
  saveToProfile: boolean;
};

export type PrivateAiStatus = {
  state: 'not-ready' | 'checking' | 'downloading' | 'installing' | 'ready' | 'updating' | 'failed';
  progress?: number;
  stage?: string;
  downloadSize?: string;
  message: string;
  canRetry?: boolean;
  updateAvailable?: boolean;
  diagnosticsId?: string;
};

export type BrowserAgentStreamEvent =
  | { type: 'snapshot'; snapshot: BrowserRunSnapshot }
  | { type: 'frame'; runId: string; frameUrl: string; frameUpdatedAt: string; width: number; height: number; sequence: number; pageGeneration: number; deviceScaleFactor: number }
  | { type: 'connection'; state: BrowserConnectionState };

export interface BrowserAgentClient {
  getPrivateAiStatus(signal?: AbortSignal): Promise<PrivateAiStatus>;
  setupPrivateAi(signal?: AbortSignal): Promise<PrivateAiStatus>;
  listRuns(signal?: AbortSignal): Promise<BrowserRunSummary[]>;
  getRun(runId: string, signal?: AbortSignal): Promise<BrowserRunSnapshot>;
  recoverRun(runId: string, signal?: AbortSignal): Promise<BrowserRunSnapshot>;
  startRun(request: StartBrowserRunRequest, signal?: AbortSignal): Promise<BrowserRunSnapshot>;
  command(runId: string, command: BrowserRunCommand, revision: number, signal?: AbortSignal): Promise<BrowserRunSnapshot>;
  decideSensitiveApproval(runId: string, approvalId: string, approved: boolean, concurrencyToken: string, signal?: AbortSignal): Promise<void>;
  answerQuestion(runId: string, questionId: string, answer: BrowserAgentQuestionAnswer, revision: number, signal?: AbortSignal): Promise<BrowserRunSnapshot>;
  sendInput(runId: string, input: BrowserInput): Promise<void>;
  deleteRun(runId: string, signal?: AbortSignal): Promise<void>;
  connect(runId: string, listener: (event: BrowserAgentStreamEvent) => void): Promise<() => Promise<void>>;
}
