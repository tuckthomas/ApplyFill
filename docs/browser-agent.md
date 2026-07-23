# Using the Browser Agent

The Browser Agent works through job applications in a browser displayed inside ApplyFill. You do not install an extension, pair a tab, copy a connection code, or reconnect when the site moves to another page.

For the exact sensitive-action policy and local-device limitations, see [Managed Browser Agent threat model](threat-model.md). For what is saved and when it is deleted, see [Data retention and deletion](data-retention.md).

## Start

1. Complete the parts of your Job Profile you want ApplyFill to reuse.
2. Open **Browser Agent** from the main navigation.
3. Paste the job-application URL and optionally add the employer and role.
4. Choose **Start Application**.

ApplyFill opens a managed browser and keeps the same objective across navigation, redirects, popups, and multi-page forms.

## Stay in control

- **Pause** asks the agent to stop at a safe boundary.
- **Take Control** gives you the mouse and keyboard. The agent cannot type or click while you are in control.
- **Return Control** lets the agent observe the current page again before continuing.
- **Stop** ends the run. When a safe checkpoint is available, the run can be resumed later.

Closing or reloading the ApplyFill page does not deliberately discard a retained run. Reopen it from recent activity to reattach.

The retained managed browser can also retain job-site cookies and login state. Those remain on this computer and rely on the operating-system account and disk protections. Delete the run or its browser data when you no longer want that state retained.

## When ApplyFill asks for help

ApplyFill pauses for login, MFA, CAPTCHA, sensitive questions, legal statements, unsupported controls, or an answer it cannot justify. Read the context, choose or enter an answer, and decide whether an eligible answer should be saved to the Job Profile.

Never paste a password or one-time code into a general profile field. Enter credentials directly while you control the managed browser.

## Final review

Reaching the last page is not permission to submit. Review the fields, attachments, sensitive disclosures, and any changes you made manually. **Approve & Submit** is a separate command. If ApplyFill cannot prove whether a submission succeeded, it stops and asks you to check; it does not submit again automatically.

## Private AI setup

If Private AI is not ready, choose **Set Up Private AI** once. ApplyFill selects and verifies a compatible local model automatically. You should never be asked to choose a provider, runtime, port, processor, GPU layer, or quantization.

If setup fails, retry from Settings. Your profile and saved runs are independent from downloaded model files.

## Emergency stop

Use **Stop** in the Browser Agent. If the interface is unresponsive, stop ApplyFill from the launcher. A packaged installation must provide one visible Start/Stop/Status control; ordinary operation must not require Task Manager, Docker, or a terminal.
