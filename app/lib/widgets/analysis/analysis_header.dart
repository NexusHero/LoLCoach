import 'package:lol_coach/models/analysis.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/analysis/analysis_common.dart';
import 'package:lol_coach/widgets/common/game_card.dart';
import 'package:material_ui/material_ui.dart';

/// Riot ID, rank, refresh button and sync status.
class AnalysisHeader extends StatelessWidget {
  const AnalysisHeader({
    required this.snapshot,
    required this.onRefresh,
    this.refreshing = false,
    super.key,
  });

  final AnalysisSnapshot snapshot;
  final VoidCallback? onRefresh;
  final bool refreshing;

  String _rankLine(RankInfo? r) {
    if (r == null || !r.isRanked) return 'Unranked';
    final div = r.division.isNotEmpty ? ' ${r.division}' : '';
    return '${r.tier}$div · ${r.leaguePoints} LP · ${r.wins}W ${r.losses}L';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final sync = snapshot.sync;
    final syncing = sync.state == 'syncing' || refreshing;
    final (syncLabel, syncColor) = switch (sync.state) {
      'syncing' => ('Syncing', colors.magic),
      'waiting_for_match' => ('Waiting for match', colors.cyan),
      'error' => ('Sync error', colors.errorLight),
      _ => ('Up to date', colors.success),
    };

    return GameCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Eyebrow(
                      'POST-GAME REVIEW · ${snapshot.region}',
                      color: colors.magic,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      snapshot.riotId ?? 'No Riot ID set',
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.title,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _rankLine(snapshot.rank),
                      style: AppTextStyles.mono.copyWith(color: colors.gold),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              OutlinedButton.icon(
                onPressed: syncing ? null : onRefresh,
                icon: syncing
                    ? SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: colors.magic,
                        ),
                      )
                    : const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Refresh'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              StatusChip(label: syncLabel, color: syncColor),
              if (sync.message != null)
                Text(
                  sync.message!,
                  style: AppTextStyles.micro.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Warning card for a missing / invalid Riot API key.
class KeyProblemCard extends StatelessWidget {
  const KeyProblemCard({required this.keyProblem, super.key});
  final String keyProblem;

  static const missingText = 'Add RIOT_API_KEY to core/.env';
  static const invalidText = 'Your Riot API key is invalid or expired. '
      'Replace RIOT_API_KEY in core/.env, then press Refresh.';

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = keyProblem == 'missing' ? missingText : invalidText;
    return GameCard(
      accent: colors.warning.withValues(alpha: 0.6),
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.key_off_rounded, color: colors.warning, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Eyebrow('RIOT API KEY', color: colors.warning),
                const SizedBox(height: 4),
                Text(text, style: AppTextStyles.body),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Prompt to set a Riot ID in Settings.
class MissingRiotIdCard extends StatelessWidget {
  const MissingRiotIdCard({this.onOpenSettings, super.key});
  final VoidCallback? onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GameCard(
      accent: colors.magicLine,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Eyebrow('SET UP', color: colors.magic),
          const SizedBox(height: 4),
          Text(
            'Add your Riot ID (Name#TAG) and region in Settings so the core '
            'can load your recent games.',
            style: AppTextStyles.body.copyWith(color: colors.textSecondary),
          ),
          if (onOpenSettings != null) ...[
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: onOpenSettings,
              icon: const Icon(Icons.settings_outlined, size: 16),
              label: const Text('Open Settings'),
            ),
          ],
        ],
      ),
    );
  }
}

/// Friendly empty state while no matches are loaded.
class NoMatchesCard extends StatelessWidget {
  const NoMatchesCard({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GameCard(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Icon(Icons.history_rounded, size: 28, color: colors.textDisabled),
          const SizedBox(height: 12),
          const Text('No matches yet', style: AppTextStyles.heading),
          const SizedBox(height: 6),
          Text(
            'Your recent ranked games load after the first sync. '
            'Play a game or hit Refresh — reviews appear here automatically.',
            textAlign: TextAlign.center,
            style: AppTextStyles.body.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}
