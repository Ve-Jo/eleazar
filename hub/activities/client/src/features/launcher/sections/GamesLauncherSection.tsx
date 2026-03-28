import SharedGamesSectionView from "../../../../../../shared/src/ui/GamesSectionView.jsx";
import type { GamesSectionModel } from "../lib/buildLauncherViewModels.ts";

type GamesLauncherSectionProps = {
  model: GamesSectionModel;
};

export default function GamesLauncherSection({ model }: GamesLauncherSectionProps) {
  return (
    <div className="launcher-section" data-launcher-page-zone="content">
      <SharedGamesSectionView
        compact={model.compact}
        coloring={model.coloring}
        eyebrow={model.eyebrow}
        title={model.title}
        subtitle={model.subtitle}
        summaryCards={model.summaryCards}
        featuredGame={model.featuredGame}
        collectionTitle={model.collectionTitle}
        collectionCountText={model.collectionCountText}
        collectionHintText={model.collectionHintText}
        games={model.games}
      />
    </div>
  );
}
