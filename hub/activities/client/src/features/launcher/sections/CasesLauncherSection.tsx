import SharedCasesSectionView from "../../../../../../shared/src/ui/CasesSectionView.jsx";
import type { CasesSectionModel } from "../lib/buildLauncherViewModels.ts";

type CasesLauncherSectionProps = {
  model: CasesSectionModel;
};

export default function CasesLauncherSection({ model }: CasesLauncherSectionProps) {
  return (
    <div className="launcher-section" data-launcher-page-zone="content">
      <SharedCasesSectionView
        compact={model.compact}
        coloring={model.coloring}
        eyebrow={model.eyebrow}
        title={model.title}
        subtitle={model.subtitle}
        summaryCards={model.summaryCards}
        calendar={model.calendar}
        featuredCase={model.featuredCase}
        collectionTitle={model.collectionTitle}
        collectionCountText={model.collectionCountText}
        cases={model.cases}
        detailPanel={model.detailPanel}
      />
    </div>
  );
}
