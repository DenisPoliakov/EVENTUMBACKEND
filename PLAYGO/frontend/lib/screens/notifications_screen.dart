import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:playgo/models/team_models.dart';
import 'package:playgo/models/user.dart';
import 'package:playgo/services/api_client.dart';
import 'package:playgo/services/admin_api.dart';
import 'package:playgo/theme/app_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, required this.user, required this.api});

  final User user;
  final AdminApi api;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late Future<List<_NotificationItem>> _future;
  static const _cacheKey = 'notifications_cache_v1';
  static const _banStateKey = 'notifications_match_ban_state_v1';
  final ApiClient _accountApi = ApiClient();

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<_NotificationItem>> _load() async {
    final login =
        widget.user.email.isNotEmpty ? widget.user.email : widget.user.username;
    if (login.isEmpty) return [];
    final scopedCacheKey = '${_cacheKey}_${login.toLowerCase()}';

    final prefs = await SharedPreferences.getInstance();
    // cleanup old shared cache key so accounts on one device don't leak notifications
    await prefs.remove(_cacheKey);

    final cachedRaw = prefs.getStringList(scopedCacheKey) ?? [];
    final previousBanState =
        prefs.getString('${_banStateKey}_${login.toLowerCase()}') ?? '';
    final cached = cachedRaw
        .map((s) => _NotificationItem.fromJsonString(s))
        .whereType<_NotificationItem>()
        .toList();
    final cachedKeys = cached.map((e) => e.key).toSet();

    final token = prefs.getString('token');
    TeamSummary? team;
    if (token != null) {
      try {
        team = await _accountApi.myTeam(token);
      } catch (_) {}
    }
    final regs = await widget.api.fetchRegistrations(
      captainLogin: login,
      teamId: team?.id,
      status: null,
      matchId: null,
    );
    final invitations = token == null
        ? const <TeamInvitationItem>[]
        : await _accountApi.myTeamInvitations(token);
    final filtered = regs.where((r) {
      final st = r.status.toUpperCase();
      return st == 'APPROVED' || st == 'REJECTED' || st == 'DELETED';
    }).toList();

    if (widget.user.matchBanUntil.isNotEmpty) {
      final until = DateTime.tryParse(widget.user.matchBanUntil);
      if (until != null && until.isAfter(DateTime.now().toUtc())) {
        final item = _NotificationItem.system(
          keyValue:
              'match-ban-${until.toIso8601String()}-${widget.user.blockReason}',
          title: 'Ограничение на подачу заявок',
          description:
              'Подача заявок недоступна до ${DateFormat('dd.MM.yyyy HH:mm').format(until.toLocal())}${widget.user.blockReason.isNotEmpty ? '. Причина: ${widget.user.blockReason}' : ''}.',
          arrivedAt: until,
        );
        if (!cachedKeys.contains(item.key)) {
          cached.add(item);
        }
        await prefs.setString(
          '${_banStateKey}_${login.toLowerCase()}',
          widget.user.matchBanUntil,
        );
      }
    } else if (previousBanState.isNotEmpty) {
      final item = _NotificationItem.system(
        keyValue: 'match-ban-lifted-$previousBanState',
        title: 'Ограничение на заявки снято',
        description: 'Подача заявок на матчи снова доступна.',
        arrivedAt: DateTime.now().toUtc(),
      );
      if (!cachedKeys.contains(item.key)) {
        cached.add(item);
      }
      await prefs.remove('${_banStateKey}_${login.toLowerCase()}');
    }

    for (final reg in filtered) {
      final match = await widget.api.fetchMatchById(reg.matchId);
      final item = _NotificationItem(
        reg: reg,
        match: match,
        arrivedAt: reg.updatedAt ?? DateTime.now().toUtc(),
      );
      if (!cachedKeys.contains(item.key)) {
        cached.add(item);
      }
    }

    for (final invite in invitations) {
      final item = _NotificationItem.teamInvite(invite: invite);
      if (!cachedKeys.contains(item.key)) {
        cached.add(item);
      }
    }

    cached.sort((a, b) => b.arrivedAt.compareTo(a.arrivedAt));
    final trimmed = cached.take(50).toList();
    await prefs.setStringList(
        scopedCacheKey, trimmed.map((e) => e.toJsonString()).toList());

    return trimmed;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Уведомления')),
      body: FutureBuilder<List<_NotificationItem>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Text('Ошибка: ${snap.error}'));
          }
          final items = snap.data ?? [];
          if (items.isEmpty) {
            return const Center(child: Text('Пока нет уведомлений'));
          }
          return RefreshIndicator(
            onRefresh: () async => setState(() => _future = _load()),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _NotificationCard(item: items[i]),
            ),
          );
        },
      ),
    );
  }
}

class _NotificationItem {
  final Registration reg;
  final MatchItem? match;
  final DateTime arrivedAt;
  final String? systemTitle;
  final String? systemDescription;
  final String? systemKey;
  final TeamInvitationItem? invite;
  _NotificationItem(
      {required this.reg,
      required this.match,
      required this.arrivedAt,
      this.systemTitle,
      this.systemDescription,
      this.systemKey,
      this.invite});

  factory _NotificationItem.system({
    required String keyValue,
    required String title,
    required String description,
    required DateTime arrivedAt,
  }) {
    return _NotificationItem(
      reg: Registration(
          id: '',
          matchId: '',
          teamId: '',
          teamName: '',
          captainName: '',
          captainLogin: '',
          status: 'SYSTEM'),
      match: null,
      arrivedAt: arrivedAt,
      systemTitle: title,
      systemDescription: description,
      systemKey: keyValue,
    );
  }

  factory _NotificationItem.teamInvite({required TeamInvitationItem invite}) {
    return _NotificationItem(
      reg: Registration(
          id: '',
          matchId: '',
          teamId: '',
          teamName: '',
          captainName: '',
          captainLogin: '',
          status: 'INVITE'),
      match: null,
      arrivedAt: DateTime.tryParse(invite.createdAt) ?? DateTime.now().toUtc(),
      invite: invite,
      systemKey: 'team-invite-${invite.id}',
    );
  }

  String get key => systemKey ?? '${reg.id}-${reg.status}';

  factory _NotificationItem.fromJsonString(String s) {
    try {
      final data = jsonDecode(s) as Map<String, dynamic>;
      final reg = Registration(
        id: data['regId'] ?? '',
        matchId: data['matchId'] ?? '',
        teamId: data['teamId'] ?? '',
        teamName: data['teamName'] ?? '',
        captainName: data['captainName'] ?? '',
        captainLogin: data['captainLogin'] ?? '',
        status: data['status'] ?? '',
        updatedAt: data['arrivedAt'] != null
            ? DateTime.tryParse(data['arrivedAt'])
            : null,
      );
      final match = MatchItem(
        id: data['matchId'] ?? '',
        title: data['matchTitle'] ?? '',
        startsAt: data['startsAt'] ?? '',
        endsAt: data['endsAt'] ?? '',
        price: '',
        priceCents: 0,
        currency: 'RUB',
        status: '',
        format: '',
        fieldType: '',
        teamSize: '',
        maxTeams: 0,
        registeredTeams: 0,
        approvedTeams: 0,
        hasOwnApproved: false,
        stadiumId: data['stadiumId'],
      );
      final arrived = data['arrivedAt'] != null
          ? DateTime.tryParse(data['arrivedAt']) ?? DateTime.now().toUtc()
          : DateTime.now().toUtc();
      return _NotificationItem(
        reg: reg,
        match: match,
        arrivedAt: arrived,
        systemTitle: data['systemTitle'] as String?,
        systemDescription: data['systemDescription'] as String?,
        systemKey: data['systemKey'] as String?,
        invite: data['invite'] is Map<String, dynamic>
            ? TeamInvitationItem.fromJson(
                data['invite'] as Map<String, dynamic>)
            : null,
      );
    } catch (_) {
      return _NotificationItem(
          reg: Registration(
              id: '',
              matchId: '',
              teamId: '',
              teamName: '',
              captainName: '',
              captainLogin: '',
              status: ''),
          match: null,
          arrivedAt: DateTime.now().toUtc(),
          invite: null);
    }
  }

  String toJsonString() {
    return jsonEncode({
      'regId': reg.id,
      'matchId': reg.matchId,
      'teamId': reg.teamId,
      'teamName': reg.teamName,
      'captainName': reg.captainName,
      'captainLogin': reg.captainLogin,
      'status': reg.status,
      'arrivedAt': arrivedAt.toIso8601String(),
      'matchTitle': match?.title ?? '',
      'startsAt': match?.startsAt ?? '',
      'endsAt': match?.endsAt ?? '',
      'stadiumId': match?.stadiumId,
      'systemTitle': systemTitle,
      'systemDescription': systemDescription,
      'systemKey': systemKey,
      'invite': invite == null
          ? null
          : {
              'id': invite!.id,
              'status': invite!.status,
              'inviteeIdentifier': invite!.inviteeIdentifier,
              'createdAt': invite!.createdAt,
              'respondedAt': invite!.respondedAt,
              'team': invite!.team == null
                  ? null
                  : {
                      'id': invite!.team!.id,
                      'name': invite!.team!.name,
                      'city': invite!.team!.city,
                      'memberCount': invite!.team!.memberCount,
                      'captain': {
                        'id': invite!.team!.captain.id,
                        'username': invite!.team!.captain.username,
                        'firstName': invite!.team!.captain.firstName,
                        'lastName': invite!.team!.captain.lastName,
                        'email': invite!.team!.captain.email,
                      },
                    },
              'inviter': invite!.inviter == null
                  ? null
                  : {
                      'id': invite!.inviter!.id,
                      'username': invite!.inviter!.username,
                      'firstName': invite!.inviter!.firstName,
                      'lastName': invite!.inviter!.lastName,
                      'email': invite!.inviter!.email,
                    },
            },
    });
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.item});
  final _NotificationItem item;

  @override
  Widget build(BuildContext context) {
    if (item.invite != null) {
      return _TeamInviteNotification(invite: item.invite!);
    }
    if (item.systemTitle != null) {
      return Card(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.orange.shade700),
                  const SizedBox(width: 8),
                  Text(
                    item.systemTitle!,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Colors.orange.shade800,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(item.systemDescription ?? ''),
            ],
          ),
        ),
      );
    }

    final status = item.reg.status.toUpperCase();
    final isApproved = status == 'APPROVED';
    final isDeleted = status == 'DELETED';
    final color = isApproved
        ? Colors.green
        : isDeleted
            ? Colors.orange.shade700
            : Colors.red;
    final match = item.match;

    String fmtDate(String? iso) {
      if (iso == null || iso.isEmpty) return '';
      try {
        final dt = DateTime.parse(iso).toLocal();
        return DateFormat('dd.MM.yyyy HH:mm').format(dt);
      } catch (_) {
        return iso;
      }
    }

    final time = fmtDate(match?.startsAt);
    final stadium = match?.title.isNotEmpty == true ? match!.title : 'Стадион';
    final badgeText = isApproved
        ? 'Заявка принята'
        : isDeleted
            ? 'Заявка удалена'
            : 'Заявка отклонена';
    final desc = isDeleted
        ? 'Ваша команда была снята с матча $stadium. Попробуйте заявиться заново.'
        : badgeText;

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                    isApproved
                        ? Icons.check_circle
                        : isDeleted
                            ? Icons.remove_circle
                            : Icons.cancel,
                    color: color),
                const SizedBox(width: 8),
                Text(badgeText,
                    style:
                        TextStyle(fontWeight: FontWeight.w700, color: color)),
                const Spacer(),
                Text(
                  DateFormat('dd.MM.y HH:mm').format(item.arrivedAt.toLocal()),
                  style: const TextStyle(color: Colors.black45, fontSize: 12),
                )
              ],
            ),
            const SizedBox(height: 8),
            Text('Команда: ${item.reg.teamName}',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            if (time.isNotEmpty)
              Text('Время: $time',
                  style: const TextStyle(color: Colors.black54)),
            Text('Матч/стадион: $stadium',
                style: const TextStyle(color: Colors.black54)),
            Text('Капитан: ${item.reg.captainName} (${item.reg.captainLogin})',
                style: const TextStyle(color: Colors.black54)),
            const SizedBox(height: 4),
            Text(desc, style: const TextStyle(color: Colors.black54)),
          ],
        ),
      ),
    );
  }
}

class _TeamInviteNotification extends StatefulWidget {
  const _TeamInviteNotification({required this.invite});

  final TeamInvitationItem invite;

  @override
  State<_TeamInviteNotification> createState() =>
      _TeamInviteNotificationState();
}

class _TeamInviteNotificationState extends State<_TeamInviteNotification> {
  final ApiClient _api = ApiClient();
  bool _loading = false;

  Future<void> _respond(bool accept) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token == null) return;
    setState(() => _loading = true);
    try {
      if (accept) {
        await _api.acceptTeamInvitation(
          token: token,
          invitationId: widget.invite.id,
        );
      } else {
        await _api.rejectTeamInvitation(
          token: token,
          invitationId: widget.invite.id,
        );
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text(accept ? 'Приглашение принято' : 'Приглашение отклонено'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Ошибка: $e')),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final team = widget.invite.team;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Приглашение в команду',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(team?.name ?? 'Команда'),
            if ((team?.city ?? '').isNotEmpty) Text('Город: ${team!.city}'),
            Text(
              'Капитан: ${team?.captain.displayName ?? widget.invite.inviter?.displayName ?? '—'}',
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _loading ? null : () => _respond(false),
                    child: const Text('Отклонить'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _loading ? null : () => _respond(true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: accentColor,
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('Принять'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
