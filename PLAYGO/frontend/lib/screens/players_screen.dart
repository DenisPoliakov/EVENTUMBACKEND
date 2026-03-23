import 'package:flutter/material.dart';
import 'package:playgo/models/player_card.dart';
import 'package:playgo/models/team_models.dart';
import 'package:playgo/services/admin_api.dart';
import 'package:playgo/services/api_client.dart';
import 'package:playgo/theme/app_theme.dart';

class PlayersScreen extends StatefulWidget {
  const PlayersScreen({super.key, required this.userCity});

  final String userCity;

  @override
  State<PlayersScreen> createState() => _PlayersScreenState();
}

class _PlayersScreenState extends State<PlayersScreen> {
  final AdminApi _api = AdminApi();
  final ApiClient _accountApi = ApiClient();
  final TextEditingController _searchCtrl = TextEditingController();
  final TextEditingController _cityCtrl = TextEditingController();
  Future<List<PlayerCard>>? _future;
  PlayerCardOptions? _options;
  String _city = '';
  String _position = '';
  String _skill = '';
  String _ratingFilter = '70';
  bool _lookingForTeam = false;

  @override
  void initState() {
    super.initState();
    _city = widget.userCity;
    _cityCtrl.text = widget.userCity;
    _loadOptions();
  }

  Future<void> _loadOptions() async {
    final options = await _accountApi.playerCardOptions();
    if (!mounted) return;
    setState(() {
      _options = options;
      _future = _loadPlayers();
    });
  }

  Future<List<PlayerCard>> _loadPlayers() {
    return _api.fetchPlayers(
      city: _city,
      position: _position,
      skill: _skill,
      minRating: _ratingFilter.isEmpty ? null : int.tryParse(_ratingFilter),
      lookingForTeam: _lookingForTeam,
      q: _searchCtrl.text.trim(),
    );
  }

  void _apply() {
    setState(() => _future = _loadPlayers());
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _cityCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final options = _options;
    return Scaffold(
      appBar: AppBar(title: const Text('Игроки')),
      body: options == null
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        TextField(
                          controller: _searchCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Поиск по нику, имени или био',
                            prefixIcon: Icon(Icons.search),
                          ),
                          onSubmitted: (_) => _apply(),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _cityCtrl,
                          decoration: const InputDecoration(labelText: 'Город'),
                          onChanged: (value) => _city = value,
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                value: _position.isEmpty ? null : _position,
                                decoration:
                                    const InputDecoration(labelText: 'Позиция'),
                                items: [
                                  const DropdownMenuItem<String>(
                                    value: '',
                                    child: Text('Все позиции'),
                                  ),
                                  ...options.positions.map(
                                    (item) => DropdownMenuItem<String>(
                                      value: item,
                                      child: Text(playerPositionLabel(item)),
                                    ),
                                  ),
                                ],
                                onChanged: (value) =>
                                    _position = value == null ? '' : value,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                value: _skill.isEmpty ? null : _skill,
                                decoration:
                                    const InputDecoration(labelText: 'Навык'),
                                items: [
                                  const DropdownMenuItem<String>(
                                    value: '',
                                    child: Text('Любой навык'),
                                  ),
                                  ...options.skillTags.map(
                                    (item) => DropdownMenuItem<String>(
                                      value: item,
                                      child: Text(playerSkillLabel(item)),
                                    ),
                                  ),
                                ],
                                onChanged: (value) =>
                                    _skill = value == null ? '' : value,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                value: _ratingFilter,
                                decoration:
                                    const InputDecoration(labelText: 'Рейтинг'),
                                items: const [
                                  DropdownMenuItem<String>(
                                    value: '',
                                    child: Text('Любой'),
                                  ),
                                  DropdownMenuItem<String>(
                                    value: '60',
                                    child: Text('От 60'),
                                  ),
                                  DropdownMenuItem<String>(
                                    value: '70',
                                    child: Text('От 70'),
                                  ),
                                  DropdownMenuItem<String>(
                                    value: '80',
                                    child: Text('От 80'),
                                  ),
                                  DropdownMenuItem<String>(
                                    value: '90',
                                    child: Text('От 90'),
                                  ),
                                ],
                                onChanged: (value) =>
                                    _ratingFilter = value ?? '',
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: FilterChip(
                                selected: _lookingForTeam,
                                label: const Text('Ищет команду'),
                                onSelected: (value) =>
                                    setState(() => _lookingForTeam = value),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _apply,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: accentColor,
                              foregroundColor: Colors.white,
                            ),
                            child: const Text('Применить фильтры'),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: FutureBuilder<List<PlayerCard>>(
                      future: _future,
                      builder: (context, snap) {
                        if (snap.connectionState == ConnectionState.waiting) {
                          return const Center(
                              child: CircularProgressIndicator());
                        }
                        if (snap.hasError) {
                          return Center(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Text(
                                  'Не удалось загрузить список игроков: ${snap.error}'),
                            ),
                          );
                        }
                        final players = snap.data ?? const [];
                        if (players.isEmpty) {
                          return const Center(
                            child: Text('Игроков по этим фильтрам пока нет'),
                          );
                        }
                        return ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                          itemCount: players.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 12),
                          itemBuilder: (context, index) =>
                              _PlayerTile(player: players[index]),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _PlayerTile extends StatelessWidget {
  const _PlayerTile({required this.player});

  final PlayerCard player;

  @override
  Widget build(BuildContext context) {
    final initial =
        player.username.isNotEmpty ? player.username[0].toUpperCase() : '?';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: accentColor.withOpacity(0.15),
                  backgroundImage: player.avatarUrl.isNotEmpty
                      ? NetworkImage('${AdminApi().baseUrl}${player.avatarUrl}')
                      : null,
                  child: player.avatarUrl.isEmpty
                      ? Text(
                          initial,
                          style: const TextStyle(
                            color: accentColor,
                            fontWeight: FontWeight.w800,
                          ),
                        )
                      : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        player.displayName,
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      Text(
                        '@${player.username}',
                        style: const TextStyle(color: Colors.black54),
                      ),
                      if (player.currentTeam != null)
                        Text(
                          'Команда: ${player.currentTeam!.name}',
                          style: const TextStyle(
                            color: accentDark,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      Text(
                        '${playerPositionLabel(player.position)} • ${player.city.isEmpty ? 'Город не указан' : player.city}',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: accentColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    children: [
                      const Text('OVR',
                          style: TextStyle(
                              fontSize: 11, fontWeight: FontWeight.w700)),
                      Text(
                        '${player.rating}',
                        style: const TextStyle(
                          color: accentDark,
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (player.bio.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(player.bio),
            ],
            if (player.currentTeam != null) ...[
              const SizedBox(height: 12),
              InkWell(
                onTap: () => _showTeamInfo(context, player.currentTeam!),
                child: Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF4F7FB),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.shield_outlined, color: accentDark),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Открыть команду ${player.currentTeam!.name}',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ...player.skillTags.map(
                  (item) => Chip(
                    label: Text(playerSkillLabel(item)),
                    backgroundColor: const Color(0xFFEAF8F8),
                  ),
                ),
                ...player.statuses.map(
                  (item) => Chip(
                    label: Text(playerStatusLabel(item)),
                    backgroundColor: const Color(0xFFFFF2DD),
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

void _showTeamInfo(BuildContext context, TeamSummaryLite team) {
  showModalBottomSheet(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            team.name,
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          if (team.city.isNotEmpty) Text('Город: ${team.city}'),
          Text('Капитан: ${team.captain.displayName}'),
          if (team.memberCount > 0) Text('Участников: ${team.memberCount}'),
          const SizedBox(height: 12),
        ],
      ),
    ),
  );
}

String playerPositionLabel(String value) {
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

String playerSkillLabel(String value) {
  switch (value) {
    case 'PACE':
      return 'Скорость';
    case 'SHOOTING':
      return 'Удар';
    case 'PASSING':
      return 'Пас';
    case 'DRIBBLING':
      return 'Дриблинг';
    case 'STAMINA':
      return 'Выносливость';
    case 'DEFENDING':
      return 'Оборона';
    default:
      return value;
  }
}

String playerStatusLabel(String value) {
  switch (value) {
    case 'LOOKING_FOR_TEAM':
      return 'Ищет команду';
    case 'READY_TO_PLAY':
      return 'Готов на игру';
    case 'CAPTAIN':
      return 'Капитан';
    case 'WITHOUT_TEAM':
      return 'Без команды';
    default:
      return value;
  }
}
