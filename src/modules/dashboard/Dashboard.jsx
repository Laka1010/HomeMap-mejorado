import { DashboardOverview } from "./DashboardOverview";

export default function Dashboard({ state, goTo, openModal, canSeeEconomy, currentHome, houseMembers, notifications }) {
  return (
    <div style={{ position: "relative" }}>
      <DashboardOverview
        state={state}
        goTo={goTo}
        openModal={openModal}
        canSeeEconomy={canSeeEconomy}
        currentHome={currentHome}
        houseMembers={houseMembers}
        notifications={notifications}
      />
    </div>
  );
}
