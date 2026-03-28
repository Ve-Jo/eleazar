import SharedBalanceSectionView from "../../../../../../shared/src/ui/BalanceSectionView.jsx";
import type { BalanceSectionModel } from "../lib/buildLauncherViewModels.ts";

type BalanceLauncherSectionProps = {
  model: BalanceSectionModel;
};

export default function BalanceLauncherSection({ model }: BalanceLauncherSectionProps) {
  return (
    <div className="launcher-section" data-launcher-page-zone="content">
      <SharedBalanceSectionView
        layout={model.layout}
        compact={model.compact}
        coloring={model.coloring}
        eyebrow={model.eyebrow}
        title={model.title}
        titleMeta={model.titleMeta}
        profilePanel={model.profilePanel}
        classicTopCards={model.classicTopCards}
        classicQuickChips={model.classicQuickChips}
        classicBanner={model.classicBanner}
        classicMarriageBanner={model.classicMarriageBanner}
        primaryCards={model.primaryCards}
        metricCards={model.metricCards}
        progress={model.progress}
        footerCards={model.footerCards}
      />
    </div>
  );
}
