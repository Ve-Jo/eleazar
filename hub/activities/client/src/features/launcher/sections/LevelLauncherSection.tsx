import SharedLevelSectionView from "../../../../../../shared/src/ui/LevelSectionView.jsx";
import type { LevelSectionModel } from "../lib/buildLauncherViewModels.ts";

type LevelLauncherSectionProps = {
  model: LevelSectionModel;
};

export default function LevelLauncherSection({ model }: LevelLauncherSectionProps) {
  return (
    <div className="launcher-section" data-launcher-page-zone="content">
      <SharedLevelSectionView
        compact={model.compact}
        coloring={model.coloring}
        eyebrow={model.eyebrow}
        title={model.title}
        titleMeta={model.titleMeta}
        subtitle={model.subtitle}
        profilePanel={model.profilePanel}
        seasonCard={model.seasonCard}
        levelCards={model.levelCards}
        rolesTitle={model.rolesTitle}
        rolesEmptyText={model.rolesEmptyText}
        upcomingRoles={model.upcomingRoles}
      />
    </div>
  );
}
