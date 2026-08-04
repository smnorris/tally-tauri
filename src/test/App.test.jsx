import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../storage.js", async () => import("./mockStorage.js"));

import { resetMockStorage } from "./mockStorage.js";
import App from "../App.jsx";

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
// pairing (assumes it's the only available pairing).
async function addPairToTimesheet(user) {
  await user.click(screen.getByRole("button", { name: "Timesheet" }));
  await user.click(await screen.findByRole("button", { name: "+ Add task" }));
  await user.click(await screen.findByRole("button", { name: "Add" }));
}

describe("Tally app", () => {
  it("shows an empty timesheet on first load", async () => {
    render(<App />);
    expect(
      await screen.findByText(/Your timesheet is empty/i)
    ).toBeInTheDocument();
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

  it("hides a task from only the week it was removed from, not other weeks", async () => {
    const user = userEvent.setup();
    render(<App />);

    await createClientProjectTask(user);
    await addPairToTimesheet(user);

    // Log hours this week, then hide the row for this week only.
    const hourInputs = screen.getAllByRole("spinbutton");
    await user.type(hourInputs[0], "2");
    await screen.findByText("2h this week");

    await user.click(screen.getByTitle("Remove from timesheet"));
    expect(screen.queryByText("Homepage layout")).not.toBeInTheDocument();

    // Next week: the task should still be there (never removed globally).
    await user.click(screen.getByRole("button", { name: "Next →" }));
    expect(await screen.findByText("Homepage layout")).toBeInTheDocument();

    // Back to the original week: still hidden there.
    await user.click(screen.getByRole("button", { name: "This week" }));
    expect(screen.queryByText("Homepage layout")).not.toBeInTheDocument();
  });

  it("exports a CSV from the Reports tab without throwing", async () => {
    const user = userEvent.setup();
    render(<App />);

    await createClientProjectTask(user);
    await addPairToTimesheet(user);
    const hourInputs = screen.getAllByRole("spinbutton");
    await user.type(hourInputs[0], "4");
    await screen.findByText("4h this week");

    await user.click(screen.getByRole("button", { name: "Reports" }));
    expect(await screen.findByText("4h")).toBeInTheDocument();

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await user.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it("filters the report by client and project", async () => {
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

    await user.click(screen.getByRole("button", { name: "Reports" }));
    expect(await screen.findByText("2h")).toBeInTheDocument();
    expect(screen.getByText("Homepage layout")).toBeInTheDocument();

    // Filtering to the entry's own client should keep it visible.
    const clientFilter = screen.getByLabelText("Client");
    await user.selectOptions(clientFilter, "Acme Corp");
    expect(await screen.findByText("2h")).toBeInTheDocument();

    // The project dropdown should be scoped to the selected client's projects.
    const projectFilter = screen.getByLabelText("Project");
    expect(within(projectFilter).getByText("Website redesign")).toBeInTheDocument();

    await user.selectOptions(projectFilter, "Website redesign");
    expect(await screen.findByText("2h")).toBeInTheDocument();
    expect(screen.getByText("Homepage layout")).toBeInTheDocument();

    // Clear filters resets both dropdowns back to "All".
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(clientFilter.value).toBe("");
    expect(projectFilter.value).toBe("");
  });
});
