import 'package:flutter/material.dart';
import 'package:playgo/models/team_models.dart';
import 'package:playgo/services/api_client.dart';
import 'package:playgo/theme/app_theme.dart';

class TeamScreen extends StatefulWidget {
  const TeamScreen({
    super.key,
    required this.api,
    required this.token,
    required this.userId,
  });

  final ApiClient api;
  final String token;
  final String userId;

  @override
  State<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends State<TeamScreen> {
  TeamSummary? _team;
  List<TeamInvitationItem> _invitations = const [];
  final TextEditingController _teamNameCtrl = TextEditingController();
  final TextEditingController _inviteCtrl = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  String? _error;

  bool get _isCaptain => _team?.captainUserId == widget.userId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _teamNameCtrl.dispose();
    _inviteCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final team = await widget.api.myTeam(widget.token);
      final invitations = await widget.api.myTeamInvitations(widget.token);
      if (!mounted) return;
      setState(() {
        _team = team;
        _invitations = invitations;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createTeam() async {
    final name = _teamNameCtrl.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Введи название команды');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final team = await widget.api.createTeam(token: widget.token, name: name);
      if (!mounted) return;
      setState(() {
        _team = team;
        _teamNameCtrl.clear();
      });
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _invite() async {
    if (_team == null) return;
    final identifier = _inviteCtrl.text.trim();
    if (identifier.isEmpty) {
      setState(() => _error = 'Введи логин или email игрока');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api.inviteToTeam(
        token: widget.token,
        teamId: _team!.id,
        identifier: identifier,
      );
      _inviteCtrl.clear();
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _respondInvite(
      TeamInvitationItem invitation, bool accept) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      if (accept) {
        await widget.api.acceptTeamInvitation(
          token: widget.token,
          invitationId: invitation.id,
        );
      } else {
        await widget.api.rejectTeamInvitation(
          token: widget.token,
          invitationId: invitation.id,
        );
      }
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _updateRole(TeamMemberItem member, String role) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api.updateTeamMemberRole(
        token: widget.token,
        memberId: member.id,
        role: role,
        fieldPosition: member.fieldPosition,
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _updateMemberPosition(
      TeamMemberItem member, String fieldPosition) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api.updateTeamMemberRole(
        token: widget.token,
        memberId: member.id,
        role: member.role,
        fieldPosition: fieldPosition,
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ваша команда')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_error != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          _error!,
                          style: TextStyle(
                            color: Colors.red.shade800,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    if (_error != null) const SizedBox(height: 12),
                    if (_invitations.isNotEmpty) ...[
                      const Text(
                        'Приглашения',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 10),
                      ..._invitations.map(
                        (invite) => Card(
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  invite.team?.name ?? 'Команда',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Капитан: ${invite.team?.captain.displayName ?? invite.inviter?.displayName ?? '—'}',
                                ),
                                if ((invite.team?.city ?? '').isNotEmpty)
                                  Text('Город: ${invite.team!.city}'),
                                const SizedBox(height: 10),
                                Row(
                                  children: [
                                    Expanded(
                                      child: OutlinedButton(
                                        onPressed: _saving
                                            ? null
                                            : () =>
                                                _respondInvite(invite, false),
                                        child: const Text('Отклонить'),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: ElevatedButton(
                                        onPressed: _saving
                                            ? null
                                            : () =>
                                                _respondInvite(invite, true),
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
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    if (_team == null)
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Вы еще не в команде. Хотите создать?',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 18,
                                ),
                              ),
                              const SizedBox(height: 12),
                              TextField(
                                controller: _teamNameCtrl,
                                decoration: const InputDecoration(
                                  labelText: 'Название команды',
                                ),
                              ),
                              const SizedBox(height: 12),
                              SizedBox(
                                width: double.infinity,
                                child: ElevatedButton(
                                  onPressed: _saving ? null : _createTeam,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: accentColor,
                                    foregroundColor: Colors.white,
                                  ),
                                  child: const Text('Создать команду'),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    else ...[
                      Card(
                        color: const Color(0xFF101821),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _team!.name,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 22,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                _team!.city.isEmpty
                                    ? 'Город не указан'
                                    : _team!.city,
                                style: TextStyle(
                                  color: Colors.white.withOpacity(0.8),
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                'Капитан: ${_team!.captain.displayName}',
                                style: const TextStyle(color: Colors.white),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (_isCaptain)
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Пригласить игрока',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 18,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                TextField(
                                  controller: _inviteCtrl,
                                  decoration: const InputDecoration(
                                    labelText: 'Логин или email игрока',
                                  ),
                                ),
                                const SizedBox(height: 12),
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton(
                                    onPressed: _saving ? null : _invite,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: accentColor,
                                      foregroundColor: Colors.white,
                                    ),
                                    child: const Text('Отправить приглашение'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      const SizedBox(height: 16),
                      const Text(
                        'Состав команды',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 10),
                      ..._team!.members.map(
                        (member) => Card(
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        member.user.displayName,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text('@${member.user.username}'),
                                      Text(
                                        '${_roleLabel(member.role)}${member.fieldPosition.isNotEmpty ? ' • ${_positionLabel(member.fieldPosition)}' : ''}',
                                        style: const TextStyle(
                                          color: Colors.black54,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (_isCaptain)
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      if (member.role != 'CAPTAIN')
                                        DropdownButton<String>(
                                          value: member.role,
                                          items: const [
                                            DropdownMenuItem(
                                              value: 'MEMBER',
                                              child: Text('Игрок'),
                                            ),
                                            DropdownMenuItem(
                                              value: 'SUBSTITUTE',
                                              child: Text('Запасной'),
                                            ),
                                          ],
                                          onChanged: _saving
                                              ? null
                                              : (value) {
                                                  if (value != null) {
                                                    _updateRole(member, value);
                                                  }
                                                },
                                        ),
                                      DropdownButton<String>(
                                        value: member.fieldPosition.isEmpty
                                            ? null
                                            : member.fieldPosition,
                                        hint: const Text('Позиция'),
                                        items: const [
                                          DropdownMenuItem(
                                            value: 'GK',
                                            child: Text('Вратарь'),
                                          ),
                                          DropdownMenuItem(
                                            value: 'DF',
                                            child: Text('Защитник'),
                                          ),
                                          DropdownMenuItem(
                                            value: 'MF',
                                            child: Text('Полузащитник'),
                                          ),
                                          DropdownMenuItem(
                                            value: 'FW',
                                            child: Text('Нападающий'),
                                          ),
                                        ],
                                        onChanged: _saving
                                            ? null
                                            : (value) {
                                                if (value != null) {
                                                  _updateMemberPosition(
                                                    member,
                                                    value,
                                                  );
                                                }
                                              },
                                      ),
                                    ],
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      if (_isCaptain && _team!.invitations.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        const Text(
                          'Ожидают ответа',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 10),
                        ..._team!.invitations.map(
                          (invite) => Card(
                            child: ListTile(
                              title: Text(invite.invitee?.displayName ??
                                  invite.inviteeIdentifier),
                              subtitle: Text(invite.inviteeIdentifier),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ],
                ),
              ),
            ),
    );
  }
}

String _roleLabel(String role) {
  switch (role) {
    case 'CAPTAIN':
      return 'Капитан';
    case 'SUBSTITUTE':
      return 'Запасной';
    default:
      return 'Игрок';
  }
}

String _positionLabel(String value) {
  switch (value) {
    case 'GK':
      return 'Вратарь';
    case 'DF':
      return 'Защитник';
    case 'MF':
      return 'Полузащитник';
    case 'FW':
      return 'Нападающий';
    default:
      return value;
  }
}
