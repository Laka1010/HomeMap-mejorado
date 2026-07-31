import { useEffect, useMemo, useState } from "react";
import { FeatureGuide } from "./FeatureGuide";
import { useTranslation } from "../../i18n";

const GUIDE_STORAGE_KEY = "homemap:onboarding:v1";

const DEFAULT_GUIDES = {
  createRoom: false,
  createZone: false,
  createBox: false,
  addObject: false,
  searchObject: false,
};

export function OnboardingManager({ user, activeTab, selectedRoomId, roomsCount, zonesCount, boxesCount, objectsCount, isHomeReady, onCreateRoomClick, onCreateZoneClick, onCreateBoxClick, onAddObjectClick }) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(DEFAULT_GUIDES);

  useEffect(() => {
    if (!user?.id) return;
    const raw = window.localStorage.getItem(`${GUIDE_STORAGE_KEY}:${user.id}`);
    if (!raw) {
      setProgress(DEFAULT_GUIDES);
      return;
    }
    try {
      setProgress({ ...DEFAULT_GUIDES, ...JSON.parse(raw) });
    } catch {
      setProgress(DEFAULT_GUIDES);
    }
  }, [user?.id]);

  const markGuide = (guideId) => {
    setProgress((current) => ({ ...current, [guideId]: true }));
  };

  useEffect(() => {
    if (!user?.id) return;
    window.localStorage.setItem(`${GUIDE_STORAGE_KEY}:${user.id}`, JSON.stringify(progress));
  }, [progress, user?.id]);

  useEffect(() => {
    const completeHandler = (event) => {
      const guideId = event?.detail?.id;
      if (guideId) markGuide(guideId);
    };
    window.addEventListener("homemap:onboarding-complete", completeHandler);
    return () => {
      window.removeEventListener("homemap:onboarding-complete", completeHandler);
    };
  }, [user?.id]);

  const visibleGuide = useMemo(() => {
    if (!user?.id || !isHomeReady) return null;

    if (activeTab === "micasa" && roomsCount === 0 && !progress.createRoom) {
      return {
        id: "createRoom",
        title: t("onboarding.tour.createRoomTitle"),
        description: t("onboarding.tour.createRoomDescription"),
        targetId: "create-room-cta",
        primaryLabel: t("onboarding.tour.createRoomButton"),
        action: () => {
          onCreateRoomClick?.();
          markGuide("createRoom");
        },
      };
    }

    if (activeTab === "micasa" && selectedRoomId && roomsCount > 0 && zonesCount === 0 && !progress.createZone) {
      return {
        id: "createZone",
        title: t("onboarding.tour.createZoneTitle"),
        description: t("onboarding.tour.createZoneDescription"),
        targetId: "create-zone-cta",
        primaryLabel: t("onboarding.tour.createZoneButton"),
        action: () => {
          onCreateZoneClick?.();
          markGuide("createZone");
        },
      };
    }

    if (activeTab === "cajas" && boxesCount === 0 && !progress.createBox) {
      return {
        id: "createBox",
        title: t("onboarding.tour.createBoxTitle"),
        description: t("onboarding.tour.createBoxDescription"),
        targetId: "create-box-cta",
        primaryLabel: t("onboarding.tour.createBoxButton"),
        action: () => {
          onCreateBoxClick?.();
          markGuide("createBox");
        },
      };
    }

    if (activeTab === "inicio" && objectsCount === 0 && !progress.addObject) {
      return {
        id: "addObject",
        title: t("onboarding.tour.addObjectTitle"),
        description: t("onboarding.tour.addObjectDescription"),
        targetId: "add-object-cta",
        primaryLabel: t("onboarding.tour.addObjectButton"),
        action: () => {
          onAddObjectClick?.();
          markGuide("addObject");
        },
      };
    }

    return null;
  }, [activeTab, boxesCount, isHomeReady, objectsCount, progress, roomsCount, user?.id, zonesCount, onAddObjectClick, onCreateBoxClick, onCreateRoomClick, onCreateZoneClick]);

  return visibleGuide ? (
    <FeatureGuide
      targetId={visibleGuide.targetId}
      title={visibleGuide.title}
      description={visibleGuide.description}
      primaryLabel={visibleGuide.primaryLabel}
      onPrimary={visibleGuide.action}
      onClose={() => markGuide(visibleGuide.id)}
    />
  ) : null;
}
