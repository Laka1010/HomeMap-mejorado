import { DashboardOverview } from "./DashboardOverview";

export default function Dashboard({ state, goTo, canSeeEconomy, currentHome, houseMembers, notifications }) {
  return (
    <div style={{ position: "relative" }}>
      <DashboardOverview
        state={state}
        goTo={goTo}
        canSeeEconomy={canSeeEconomy}
        currentHome={currentHome}
        houseMembers={houseMembers}
        notifications={notifications}
      />
    </div>
  );
}
