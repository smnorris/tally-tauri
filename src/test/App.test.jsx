import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../storage.js", async () => import("./mockStorage.js"));

import { resetMockStorage } from "./mockStorage.js";
import App, { fmtISO, getMonday } from "../App.jsx";

beforeEach(() => {
  resetMockStorage();
});

// Creates one client -> one project -> one task assigned to that project.
// Leaves the app on the Tasks tab when done.
async function createClientProjectTask(
  user,
  { clientName = "Acme Corp", projectName = "Website redesign", taskName = "Homepage layout" } = {}
) {
  await user.click(await screen.findByRole("button", { name: "Clients" }));
  await user.type(screen.getByPlaceholderText("Acme Corp"), clientName);
  await user.click(screen.getByRole("button", { name: "Add client" }));
  await screen.findByText(clientName);

  await user.click(screen.getByRole("button", { name: "Projects" }));
  await user.type(screen.getByPlaceholderText("Website redesign"), projectName);
  await user.selectOptions(screen.getByLabelText("Client"), clientName);
  await user.click(screen.getByRole("button", { name: "Add project" }));
  await screen.findByText(projectName);

  await user.click(screen.getByRole("button", { name: "Tasks" }));
  await user.type(screen.getByPlaceholderText("Homepage layout"), taskName);
  await user.click(screen.getByLabelText(projectName));
  await user.click(screen.getByRole("button", { name: "Add task" }));
  await screen.findByText(taskName);
}

// From the Timesheet tab, opens the add panel and adds the given task/project
// pairing (assumes it's the only available pairing). The whole row is
// clickable (task name, project name, or the "Add" label all work) - the
// "Add" text is a plain span, not a button, so we click it by text.
async function addPairToTimesheet(user) {
  await user.click(screen.getByRole("button", { name: "Timesheet" }));
  await user.click(await screen.findByRole("button", { name: "+ Add task" }));
  const addLabel = await screen.findByText("Add");
  await user.click(addLabel.closest("div"));
  await user.click(screen.getByRole("button", { name: "Close" }));
}

// Switches to the Report tab and widens its date range to cover everything,
// since it defaults to the previous calendar month and our tests log time
// "today" (i.e. the current month).
async function goToReportWidened(user) {
  await user.click(screen.getByRole("button", { name: "Report" }));
  const fromInput = await screen.findByLabelText("From");
  const toInput = screen.getByLabelText("To");
  fireEvent.change(fromInput, { target: { value: "2000-01-01" } });
  fireEvent.change(toInput, { target: { value: "2100-12-31" } });
}

describe("Tally app", () => {
  it("shows an empty timesheet on first load", async () => {
    render(<App />);
    expect(await screen.findByText(/Your timesheet is empty/i)).toBeInTheDocument();
  });

  it("creates a client, project, and task, adds it to the timesheet, and totals logged hours", async () => {
    const user = userEvent.setup();
    render(<App />);

    await createClientProjectTask(user);
    await addPairToTimesheet(user);

    expect(screen.getByText("Homepage layout")).toBeInTheDocument();
    expect(screen.getByText(/Website redesign/)).toBeInTheDocument();

    const hourInputs = screen.getAllByRole("spinbutton");
    expect(hourInputs).toHaveLength(7); // Mon-Sun

    await user.type(hourInputs[0], "3");

    expect(await screen.findByText("3h this week")).toBeInTheDocument();
  });

  it("archives a project, hides it by default, and can unarchive it", async () => {
    const user = userEvent.setup();
    render(<App />);

    await createClientProjectTask(user);
    await user.click(screen.getByRole("button", { name: "Projects" }));

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(screen.getByText(/archived/i)).toBeInTheDocument();

    // Default view hides archived projects.
    expect(
      screen.getByText("No projects yet. Add a project once you have a client.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Show archived/i }));
    expect(screen.getByText("Website redesign")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unarchive" }));
    expect(screen.queryByText(/· archived/i)).not.toBeInTheDocument();
  });

  it("requires a second click to confirm deleting a client", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Clients" }));
    await user.type(screen.getByPlaceholderText("Acme Corp"), "Acme Corp");
    await user.click(screen.getByRole("button", { name: "Add client" }));
    await screen.findByText("Acme Corp");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Sure?")).toBeInTheDocument();

    // Clicking "No" cancels; the client stays.
    await user.click(screen.getByRole("button", { name: "No" }));
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.queryByText("Sure?")).not.toBeInTheDocument();

    // Confirming with "Yes" actually deletes it.
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(
      await screen.findByText("No clients yet. Add your first client to get started.")
    ).toBeInTheDocument();
  });

  it("each week starts with all tasks hidden by default", async () => {
    const user = userEvent.setup();
    render(<App />);

    await createClientProjectTask(user);
    await addPairToTimesheet(user);
    expect(screen.getByText("Homepage layout")).toBeInTheDocument();

    // Next week: nothing was explicitly added there, and no hours logged there.
    await user.click(screen.getByRole("button", { name: "Next →" }));
    expect(screen.queryByText("Homepage layout")).not.toBeInTheDocument();

    // Back to the original week: still shown, since it was explicitly added there.
    await user.click(screen.getByRole("button", { name: "This week" }));
    expect(screen.getByText("Homepage layout")).toBeInTheDocument();
  });

  it("only shows the remove button when a row has no logged hours this week", async () => {
    const user = userEvent.setup();
    render(<App />);

    await createClientProjectTask(user);
    await addPairToTimesheet(user);

    // Freshly added, no hours yet: remove button is present.
    expect(screen.getByTitle("Remove from timesheet")).toBeInTheDocument();

    const hourInputs = screen.getAllByRole("spinbutton");
    await user.type(hourInputs[0], "2");
    await screen.findByText("2h this week");

    // Once hours are logged, the remove button disappears - the row can't be
    // hidden while it has data, since logged hours force it visible anyway.
    expect(screen.queryByTitle("Remove from timesheet")).not.toBeInTheDocument();

    // Clear the hours back to zero: remove button reappears, and works.
    await user.clear(hourInputs[0]);
    await user.click(await screen.findByTitle("Remove from timesheet"));
    expect(screen.queryByText("Homepage layout")).not.toBeInTheDocument();
  });

  it("Copy from last week pulls forward tasks with logged hours from the previous week", async () => {
    const user = userEvent.setup();
    render(<App />);

    await createClientProjectTask(user);
    await addPairToTimesheet(user);
    const hourInputs = screen.getAllByRole("spinbutton");
    await user.type(hourInputs[0], "3");
    await screen.findByText("3h this week");

    // Move to next week: task isn't there by default.
    await user.click(screen.getByRole("button", { name: "Next →" }));
    expect(screen.queryByText("Homepage layout")).not.toBeInTheDocument();

    // Copy from last week brings it back, with no hours logged yet this week.
    await user.click(screen.getByRole("button", { name: "Copy from last week" }));
    expect(await screen.findByText("Homepage layout")).toBeInTheDocument();
    expect(screen.getByText("0h this week")).toBeInTheDocument();
  });

  it("exports a CSV matching Timemator's column format", async () => {
    const user = userEvent.setup();
    render(<App />);

    await createClientProjectTask(user);
    await addPairToTimesheet(user);
    const hourInputs = screen.getAllByRole("spinbutton");
    await user.type(hourInputs[0], "4");
    await screen.findByText("4h this week");

    await goToReportWidened(user);
    expect(await screen.findByText("4h/$0")).toBeInTheDocument();

    let capturedText = "";
    const OriginalBlob = globalThis.Blob;
    class SpyBlob extends OriginalBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedText = parts.join("");
      }
    }
    globalThis.Blob = SpyBlob;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await user.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // One row per time entry, Timemator's expected columns. The task column
    // concatenates project and task name, separated by " - ".
    const lines = capturedText.split("\r\n");
    expect(lines[0]).toBe("folder,task,date,duration_decimal,hourly_rate");
    expect(lines[1]).toContain("Acme Corp");
    expect(lines[1]).toContain("Website redesign - Homepage layout");
    expect(lines[1]).toContain("4");

    clickSpy.mockRestore();
    globalThis.Blob = OriginalBlob;
  });

  it("filters the report by client, project, and task", async () => {
    const user = userEvent.setup();
    render(<App />);

    await createClientProjectTask(user, {
      clientName: "Acme Corp",
      projectName: "Website redesign",
      taskName: "Homepage layout",
    });
    await addPairToTimesheet(user);
    const hourInputs = screen.getAllByRole("spinbutton");
    await user.type(hourInputs[0], "2");
    await screen.findByText("2h this week");

    await goToReportWidened(user);
    expect(await screen.findByText("2h/$0")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Homepage layout")).toBeInTheDocument();

    // Filtering to the entry's own client should keep it visible.
    const clientFilter = screen.getByLabelText("Client");
    await user.selectOptions(clientFilter, "Acme Corp");
    expect(await screen.findByText("2h/$0")).toBeInTheDocument();

    // The project dropdown should be scoped to the selected client's projects.
    const projectFilter = screen.getByLabelText("Project");
    expect(within(projectFilter).getByText("Website redesign")).toBeInTheDocument();
    await user.selectOptions(projectFilter, "Website redesign");
    expect(await screen.findByText("2h/$0")).toBeInTheDocument();

    // The task dropdown should be scoped to the selected project's tasks.
    const taskFilter = screen.getByLabelText("Task");
    expect(within(taskFilter).getByText("Homepage layout")).toBeInTheDocument();
    await user.selectOptions(taskFilter, "Homepage layout");
    expect(await screen.findByText("2h/$0")).toBeInTheDocument();

    // Clear filters resets all three dropdowns back to "All".
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(clientFilter.value).toBe("");
    expect(projectFilter.value).toBe("");
    expect(taskFilter.value).toBe("");
  });

  it("sets the From date to the oldest uninvoiced entry via the Earliest date toggle", async () => {
    const user = userEvent.setup();
    render(<App />);

    await createClientProjectTask(user);
    await addPairToTimesheet(user);
    const hourInputs = screen.getAllByRole("spinbutton");
    await user.type(hourInputs[0], "3");
    await screen.findByText("3h this week");

    const entryDate = fmtISO(getMonday(new Date()));

    // Manually set a From date after the entry, and a wide To, so only the
    // From boundary is under test.
    await user.click(screen.getByRole("button", { name: "Report" }));
    const fromInput = await screen.findByLabelText("From");
    const toInput = screen.getByLabelText("To");
    fireEvent.change(fromInput, { target: { value: "2100-01-01" } });
    fireEvent.change(toInput, { target: { value: "2100-12-31" } });
    expect(await screen.findByText(/No time entries match this filter/i)).toBeInTheDocument();

    // Checking "Earliest date" overrides the manual From with the oldest
    // uninvoiced entry's date matching the filters below, and disables From
    // (but not To) for manual editing.
    await user.click(screen.getByLabelText("Earliest date (uninvoiced)"));
    expect(await screen.findByText("3h/$0")).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toBeDisabled();
    expect(screen.getByLabelText("From").value).toBe(entryDate);
    expect(screen.getByLabelText("To")).not.toBeDisabled();

    // It still composes with the client/project/task filters.
    await user.selectOptions(screen.getByLabelText("Client"), "Acme Corp");
    expect(await screen.findByText("3h/$0")).toBeInTheDocument();

    // Once the only uninvoiced entry is marked invoiced, there's no oldest
    // uninvoiced date left to anchor on, so nothing matches.
    await user.click(screen.getByRole("button", { name: "Mark as Invoiced" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(await screen.findByText(/No time entries match this filter/i)).toBeInTheDocument();

    // Clear filters unchecks the toggle and restores the manually-entered From date.
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByLabelText("Earliest date (uninvoiced)")).not.toBeChecked();
    expect(screen.getByLabelText("From")).not.toBeDisabled();
    expect(screen.getByLabelText("From").value).toBe("2100-01-01");
  });

  it("marks filtered entries as invoiced, locking them in the timesheet, and can be unmarked", async () => {
    const user = userEvent.setup();
    render(<App />);

    await createClientProjectTask(user);
    await addPairToTimesheet(user);
    const hourInputs = screen.getAllByRole("spinbutton");
    await user.type(hourInputs[0], "5");
    await screen.findByText("5h this week");

    await goToReportWidened(user);
    await screen.findByText("5h/$0");

    await user.click(screen.getByRole("button", { name: "Mark as Invoiced" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(await screen.findByText("✓ Invoiced")).toBeInTheDocument();

    // Back on the timesheet, the day cell should now be disabled.
    await user.click(screen.getByRole("button", { name: "Timesheet" }));
    expect(screen.getAllByRole("spinbutton")[0]).toBeDisabled();

    // Unmark restores editability.
    await goToReportWidened(user);
    await user.click(screen.getByRole("button", { name: "Unmark as Invoiced" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(screen.queryByText("✓ Invoiced")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Timesheet" }));
    expect(screen.getAllByRole("spinbutton")[0]).not.toBeDisabled();
  });

  it("blocks deleting a task that has invoiced time entries", async () => {
    const user = userEvent.setup();
    render(<App />);

    await createClientProjectTask(user);
    await addPairToTimesheet(user);
    const hourInputs = screen.getAllByRole("spinbutton");
    await user.type(hourInputs[0], "1");
    await screen.findByText("1h this week");

    await goToReportWidened(user);
    await screen.findByText("1h/$0");
    await user.click(screen.getByRole("button", { name: "Mark as Invoiced" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));
    await screen.findByText("✓ Invoiced");

    await user.click(screen.getByRole("button", { name: "Tasks" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));

    expect(await screen.findByText(/has invoiced time entries/i)).toBeInTheDocument();
    // The task should still be there since deletion was blocked.
    expect(screen.getByText("Homepage layout")).toBeInTheDocument();
  });
});
