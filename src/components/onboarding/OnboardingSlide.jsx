
export function OnboardingSlide({ title, description, children }) {
  return (
    <section className="onboarding-slide hm-fade-in">
      <div className="onboarding-illustration">{children}</div>
      <h1 className="hm-display onboarding-title">{title}</h1>
      <p className="onboarding-description">{description}</p>
    </section>
  );
}
