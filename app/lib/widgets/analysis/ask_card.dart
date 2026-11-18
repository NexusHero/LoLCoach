import 'package:lol_coach/models/analysis.dart';
import 'package:lol_coach/theme/app_colors.dart';
import 'package:lol_coach/theme/app_text_styles.dart';
import 'package:lol_coach/widgets/analysis/analysis_common.dart';
import 'package:material_ui/material_ui.dart';

/// "Ask your history": free-text questions answered by the core.
class AskHistoryCard extends StatefulWidget {
  const AskHistoryCard({
    required this.questions,
    required this.onAsk,
    this.enabled = true,
    super.key,
  });

  final List<AnalysisQuestion> questions;
  final ValueChanged<String>? onAsk;
  final bool enabled;

  @override
  State<AskHistoryCard> createState() => _AskHistoryCardState();
}

class _AskHistoryCardState extends State<AskHistoryCard> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _submit() {
    final q = _ctrl.text.trim();
    if (q.isEmpty || widget.onAsk == null) return;
    widget.onAsk!(q);
    _ctrl.clear();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final canAsk = widget.enabled && widget.onAsk != null;
    return BentoCard(
      title: 'ASK YOUR HISTORY',
      titleColor: colors.magic,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  key: const ValueKey('askField'),
                  controller: _ctrl,
                  enabled: canAsk,
                  decoration: const InputDecoration(
                    hintText: 'e.g. Why do I lose lane against Zed?',
                    isDense: true,
                  ),
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _submit(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                tooltip: 'Send',
                onPressed: canAsk ? _submit : null,
                icon: Icon(Icons.send_rounded, color: colors.magic),
              ),
            ],
          ),
          for (final q in widget.questions.reversed) ...[
            const SizedBox(height: 14),
            _QuestionBlock(question: q),
          ],
        ],
      ),
    );
  }
}

class _QuestionBlock extends StatelessWidget {
  const _QuestionBlock({required this.question});
  final AnalysisQuestion question;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final q = question;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(q.question, style: AppTextStyles.bodyBold),
        const SizedBox(height: 6),
        if (q.isPending)
          Row(
            children: [
              SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: colors.magic,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Thinking…',
                style: AppTextStyles.caption.copyWith(
                  color: colors.textSecondary,
                ),
              ),
            ],
          )
        else if (q.error != null)
          Text(
            q.error!,
            style: AppTextStyles.caption.copyWith(color: colors.errorLight),
          )
        else
          Text(
            q.answer!,
            style: AppTextStyles.caption.copyWith(color: colors.textSecondary),
          ),
      ],
    );
  }
}
