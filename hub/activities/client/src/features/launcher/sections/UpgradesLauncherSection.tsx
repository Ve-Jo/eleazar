import SharedUpgradesSectionView from "../../../../../../shared/src/ui/UpgradesSectionView.jsx";
import type { UpgradesSectionModel } from "../lib/buildLauncherViewModels.ts";

type UpgradesLauncherSectionProps = {
  model: UpgradesSectionModel;
};

export default function UpgradesLauncherSection({ model }: UpgradesLauncherSectionProps) {
  return (
    <div className="launcher-section" data-launcher-page-zone="content">
      <SharedUpgradesSectionView
        compact={model.compact}
        coloring={model.coloring}
        eyebrow={model.eyebrow}
        title={model.title}
        subtitle={model.subtitle}
        summaryCards={model.summaryCards}
        featuredUpgrade={model.featuredUpgrade}
        categoriesTitle={model.categoriesTitle}
        categoriesHint={model.categoriesHint}
        categories={model.categories}
        upgrades={model.upgrades}
      />
    </div>
  );
}
