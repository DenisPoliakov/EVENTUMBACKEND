import 'dart:async';

import 'package:flutter/material.dart';
import 'package:playgo/models/team_models.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:playgo/models/user.dart';
import 'package:playgo/services/admin_api.dart';
import 'package:playgo/services/api_client.dart';
import 'package:intl/intl.dart';
import 'package:playgo/theme/app_theme.dart';

class StadiumMatchesScreen extends StatefulWidget {
  const StadiumMatchesScreen(
      {super.key,
      required this.api,
      required this.stadium,
      required this.user});
  final AdminApi api;
  final Stadium stadium;
  final User user;

  @override
  State<StadiumMatchesScreen> createState() => _StadiumMatchesScreenState();
}

class _StadiumMatchesScreenState extends State<StadiumMatchesScreen> {
  late Future<_MatchesData> _future;
  final ApiClient _accountApi = ApiClient();
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _future = _load();
    _refreshTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (!mounted) return;
      setState(() {
        _future = _load();
      });
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<_MatchesData> _load() async {
    User effectiveUser = widget.user;
    TeamSummary? team;
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token != null) {
      try {
        final me = await _accountApi.me(token);
        effectiveUser =
            User.fromJson((me['user'] ?? {}) as Map<String, dynamic>);
      } catch (_) {}
      try {
        team = await _accountApi.myTeam(token);
      } catch (_) {}
    }

    final matches = await widget.api.fetchMatches(widget.stadium.id);
    final login = effectiveUser.email.isNotEmpty
        ? effectiveUser.email
        : (effectiveUser.username.isNotEmpty ? effectiveUser.username : '');
    Map<String, Registration> regs = {};
    if (login.isNotEmpty || (team?.id.isNotEmpty ?? false)) {
      final list = await widget.api.fetchRegistrations(
          captainLogin: login, teamId: team?.id, status: null, matchId: null);
      regs = {
        for (final r in list)
          if (r.matchId.isNotEmpty) r.matchId: r
      };
    }
    final decorated = matches
        .map((m) => m.copyWith(
            hasOwnApproved:
                (regs[m.id]?.status.toUpperCase() ?? '') == 'APPROVED'))
        .toList();
    return _MatchesData(
      matches: decorated,
      regs: regs,
      selfLogin: login,
      user: effectiveUser,
      team: team,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.stadium.name)),
      body: FutureBuilder<_MatchesData>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text('Ошибка загрузки матчей: ${snap.error}'),
              ),
            );
          }
          final data = snap.data;
          final matches = data?.matches ?? [];
          if (matches.isEmpty) {
            return const Center(child: Text('Открытых матчей нет'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: matches.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, i) => _MatchCard(
              match: matches[i],
              api: widget.api,
              user: data?.user ?? widget.user,
              selfReg: data?.regs[matches[i].id],
              selfLogin: data?.selfLogin ?? '',
              team: data?.team,
            ),
          );
        },
      ),
    );
  }
}

class _MatchesData {
  final List<MatchItem> matches;
  final Map<String, Registration> regs;
  final String selfLogin;
  final User user;
  final TeamSummary? team;
  _MatchesData(
      {required this.matches,
      required this.regs,
      required this.selfLogin,
      required this.user,
      required this.team});
}

class _MatchCard extends StatelessWidget {
  const _MatchCard(
      {required this.match,
      required this.api,
      required this.user,
      this.selfReg,
      required this.selfLogin,
      this.team});
  final MatchItem match;
  final AdminApi api;
  final User user;
  final Registration? selfReg;
  final String selfLogin;
  final TeamSummary? team;

  @override
  Widget build(BuildContext context) {
    String fmtDate(String iso) {
      if (iso.isEmpty) return '—';
      try {
        final dt = DateTime.parse(iso).toLocal();
        return DateFormat('dd.MM.yyyy HH:mm').format(dt);
      } catch (_) {
        return iso;
      }
    }

    String pretty(String v) {
      if (v.isEmpty) return '—';
      final upper = v.toUpperCase();
      const map = {
        'FIVE_X_FIVE': '5×5',
        'SIX_X_SIX': '6×6',
        'SEVEN_X_SEVEN': '7×7',
        'EIGHT_X_EIGHT': '8×8',
        'ELEVEN_X_ELEVEN': '11×11',
      };
      if (map.containsKey(upper)) return map[upper]!;
      // fallbacks: replace underscores -> spaces, x/X -> ×
      return upper
          .replaceAll('_', ' ')
          .replaceAll('X', '×')
          .replaceAll('x', '×');
    }

    String statusPretty(String v) {
      switch (v.toUpperCase()) {
        case 'OPEN':
          return 'Открыт';
        case 'FILLED':
          return 'Заполнен';
        case 'FINISHED':
          return 'Завершён';
        case 'CANCELLED':
          return 'Отменён';
        default:
          return pretty(v);
      }
    }

    String slots() {
      final approved =
          match.approvedTeams > 0 ? match.approvedTeams : match.registeredTeams;
      if (match.maxTeams > 0) {
        return '$approved/${match.maxTeams} команд';
      }
      if (approved > 0) {
        return '$approved заявок';
      }
      return 'Свободно';
    }

    String priceStr() {
      // prefer priceCents if available
      if (match.priceCents > 0) {
        final fmt = NumberFormat.currency(
          locale: 'ru_RU',
          symbol: match.currency.toUpperCase() == 'RUB' ? '₽' : match.currency,
          decimalDigits: 2,
        );
        return fmt.format(match.priceCents / 100) + ' за команду';
      }
      if (match.price.isEmpty) return '—';
      final numVal = num.tryParse(match.price);
      if (numVal != null) {
        final fmt = NumberFormat.currency(
          locale: 'ru_RU',
          symbol: '₽',
          decimalDigits: 0,
        );
        return fmt.format(numVal) + ' за команду';
      }
      return '${match.price} ₽';
    }

    final status = selfReg?.status.toUpperCase() ?? '';
    final hasReg = selfReg != null;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(match.title.isNotEmpty ? match.title : 'Матч',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(
              'Начало: ${fmtDate(match.startsAt)}',
              style: const TextStyle(color: Colors.black54),
            ),
            if (match.endsAt.isNotEmpty)
              Text('Конец: ${fmtDate(match.endsAt)}',
                  style: const TextStyle(color: Colors.black54)),
            if (match.format.isNotEmpty)
              Text('Формат: ${pretty(match.format)}',
                  style: const TextStyle(color: Colors.black54)),
            if (match.fieldType.isNotEmpty)
              Text('Поле/покрытие: ${pretty(match.fieldType)}',
                  style: const TextStyle(color: Colors.black54)),
            if (match.teamSize.isNotEmpty)
              Text('Состав: ${pretty(match.teamSize)}',
                  style: const TextStyle(color: Colors.black54)),
            Text('Статус: ${statusPretty(match.status)}',
                style: const TextStyle(color: Colors.black54)),
            Text('Команды: ${slots()}',
                style: const TextStyle(color: Colors.black54)),
            Text('Цена: ${priceStr()}',
                style: const TextStyle(
                    color: Colors.black54, fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            if (hasReg)
              _StatusBadge(status: status)
            else if (_hasNoPlayerCard())
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF2F5FF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFD9E4FF)),
                ),
                child: const Text(
                  'Сначала создай карточку футболиста в профиле. Без нее заявка на матч недоступна.',
                  style: TextStyle(
                    color: Color(0xFF3157B6),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              )
            else if (_hasRegistrationBan())
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                decoration: BoxDecoration(
                  color: Colors.orange.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.orange.withOpacity(0.3)),
                ),
                child: Text(
                  _registrationBanLabel(),
                  style: TextStyle(
                    color: Colors.orange.shade800,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              )
            else if (team == null)
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF3E8),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFFD7B8)),
                ),
                child: const Text(
                  'Чтобы заявиться на матч, сначала создай команду или вступи в существующую.',
                  style: TextStyle(
                    color: Color(0xFFB85E16),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              )
            else
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accentColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () => _openRegisterSheet(context),
                  child: const Text('Заявиться'),
                ),
              ),
          ],
        ),
      ),
    );
  }

  bool _hasRegistrationBan() {
    return user.matchBanUntil.isNotEmpty &&
        _isFutureDate(widgetUserBan: user.matchBanUntil);
  }

  bool _hasNoPlayerCard() {
    return !user.hasPlayerCard;
  }

  String _registrationBanLabel() {
    if (user.matchBanUntil.isEmpty) {
      return 'Подача заявок временно недоступна';
    }
    try {
      final dt = DateTime.parse(user.matchBanUntil).toLocal();
      return 'Подача заявок недоступна до ${DateFormat('dd.MM.yyyy HH:mm').format(dt)}${user.blockReason.isNotEmpty ? '. Причина: ${user.blockReason}' : ''}';
    } catch (_) {
      return 'Подача заявок временно недоступна';
    }
  }

  bool _isFutureDate({required String? widgetUserBan}) {
    final raw = widgetUserBan;
    if (raw == null || raw.isEmpty) return false;
    try {
      return DateTime.parse(raw).isAfter(DateTime.now().toUtc());
    } catch (_) {
      return false;
    }
  }

  void _openRegisterSheet(BuildContext context) {
    final teamName = team?.name ?? '';
    final fallbackCaptainName =
        '${user.firstName} ${user.lastName}'.trim().isNotEmpty
            ? '${user.firstName} ${user.lastName}'.trim()
            : (user.username.isNotEmpty ? user.username : user.email);
    final captainName = team?.captain.displayName.trim().isNotEmpty == true
        ? team!.captain.displayName.trim()
        : fallbackCaptainName;
    final captainLogin = team?.captain.email.isNotEmpty == true
        ? team!.captain.email
        : (team?.captain.username.isNotEmpty == true
            ? team!.captain.username
            : selfLogin);
    final teamCtrl = TextEditingController(text: teamName);
    final captainCtrl = TextEditingController(text: captainName);
    final loginCtrl = TextEditingController(text: captainLogin);
    final noteCtrl = TextEditingController();
    final participantsCtrl =
        TextEditingController(text: team?.members.length.toString() ?? '');
    final isTeamBound = team != null;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
            top: 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Заявка на матч',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
              const SizedBox(height: 12),
              TextField(
                controller: teamCtrl,
                readOnly: isTeamBound,
                decoration: const InputDecoration(
                  labelText: 'Название команды',
                  hintText: 'Название вашей команды',
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: captainCtrl,
                readOnly: isTeamBound,
                decoration: const InputDecoration(
                  labelText: 'ФИО капитана',
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: loginCtrl,
                readOnly: isTeamBound,
                decoration: const InputDecoration(
                  labelText: 'Логин/Email капитана',
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: participantsCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Кол-во игроков в команде',
                  hintText: 'Например, 10',
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: noteCtrl,
                decoration: const InputDecoration(
                  labelText: 'Комментарий (необязательно)',
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accentColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () async {
                    final teamName = teamCtrl.text.trim();
                    final captain = captainCtrl.text.trim();
                    final login = loginCtrl.text.trim();
                    final note = noteCtrl.text.trim();
                    final participants = int.tryParse(
                        participantsCtrl.text.trim() == ''
                            ? '-1'
                            : participantsCtrl.text.trim());
                    if (teamName.isEmpty || captain.isEmpty || login.isEmpty) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(
                            content: Text(
                                'Заполни название команды, ФИО и логин капитана')),
                      );
                      return;
                    }
                    if (participants != null && participants <= 0) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(
                            content:
                                Text('Укажи количество игроков числом > 0')),
                      );
                      return;
                    }
                    Navigator.of(ctx).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Заявка отправляется...')),
                    );
                    try {
                      await api.register(
                        matchId: match.id,
                        teamName: teamName,
                        captainName: captain,
                        captainLogin: login,
                        teamId: team?.id,
                        note: note.isEmpty ? null : note,
                        participants: (participants != null && participants > 0)
                            ? participants
                            : null,
                      );
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Заявка отправлена')),
                      );
                    } catch (e) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Ошибка: $e')),
                      );
                    }
                  },
                  child: const Text('Отправить заявку'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    String label;
    Color color;
    switch (status) {
      case 'APPROVED':
        label = 'Ваша заявка принята';
        color = Colors.green.shade600;
        break;
      case 'REJECTED':
        label = 'Ваша заявка отклонена';
        color = Colors.red.shade600;
        break;
      default:
        label = 'Заявка рассматривается';
        color = Colors.orange.shade700;
    }
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
