import 'package:flutter/material.dart';
import 'package:playgo/models/player_card.dart';
import 'package:playgo/models/team_models.dart';
import 'package:playgo/models/user.dart';
import 'package:playgo/theme/app_theme.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({
    super.key,
    required this.user,
    required this.onLogout,
    required this.onOpenSettings,
    required this.onOpenPlayerCard,
    required this.onOpenTeam,
    this.playerCard,
    this.team,
  });

  final User user;
  final VoidCallback onLogout;
  final VoidCallback onOpenSettings;
  final VoidCallback onOpenPlayerCard;
  final VoidCallback onOpenTeam;
  final PlayerCard? playerCard;
  final TeamSummary? team;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Профиль'),
        actions: [
          IconButton(
            onPressed: onOpenSettings,
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Настройки',
          ),
          IconButton(
            onPressed: onLogout,
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Выйти',
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: ListView(
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: accentColor.withOpacity(0.15),
                    child: Text(
                      user.username.isNotEmpty
                          ? user.username[0].toUpperCase()
                          : '?',
                      style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: accentColor),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.firstName.isNotEmpty
                            ? '${user.firstName} ${user.lastName}'
                            : 'Добавь имя и фамилию',
                        style: Theme.of(context)
                            .textTheme
                            .titleLarge
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      Text(user.email,
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(color: Colors.black54)),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  const Icon(Icons.location_on_outlined, color: accentColor),
                  const SizedBox(width: 6),
                  Text(
                    user.city.isEmpty ? 'Укажи город' : user.city,
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Аккаунт',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 12),
                      _infoRow('Email', user.email),
                      _infoRow('Логин', user.username),
                      _infoRow(
                          'Имя', user.firstName.isEmpty ? '—' : user.firstName),
                      _infoRow('Фамилия',
                          user.lastName.isEmpty ? '—' : user.lastName),
                      _infoRow('Город', user.city.isEmpty ? '—' : user.city),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Card(
                color: const Color(0xFF101821),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        playerCard == null
                            ? 'Создай карточку футболиста'
                            : 'Твоя карточка футболиста',
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        playerCard == null
                            ? 'Без карточки сейчас нельзя заявиться на матч. Добавь позицию, сильные стороны, статус и фото.'
                            : '${_positionLabel(playerCard!.position)} • ${_formatLabel(playerCard!.favoriteFormat)} • рейтинг ${playerCard!.rating}',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.82),
                          height: 1.35,
                        ),
                      ),
                      if (playerCard != null &&
                          playerCard!.skillTags.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: playerCard!.skillTags
                                .map(
                                  (item) => Chip(
                                    label: Text(_skillLabel(item)),
                                    backgroundColor: const Color(0xFF17353A),
                                    labelStyle:
                                        const TextStyle(color: Colors.white),
                                  ),
                                )
                                .toList(),
                          ),
                        ),
                      const SizedBox(height: 14),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: onOpenPlayerCard,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: accentColor,
                            foregroundColor: Colors.white,
                          ),
                          child: Text(playerCard == null
                              ? 'Создать карточку футболиста'
                              : 'Редактировать карточку'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Ваша команда',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        team == null
                            ? 'Вы еще не в команде. Хотите создать?'
                            : '${team!.name}${team!.city.isNotEmpty ? ' • ${team!.city}' : ''}',
                        style: const TextStyle(height: 1.35),
                      ),
                      if (team != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            'Участников: ${team!.members.length}',
                            style: const TextStyle(color: Colors.black54),
                          ),
                        ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: onOpenTeam,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: accentColor,
                            foregroundColor: Colors.white,
                          ),
                          child: Text(
                            team == null
                                ? 'Открыть команды'
                                : team!.captainUserId == user.id
                                    ? 'Управлять командой'
                                    : 'Открыть мою команду',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
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

String _formatLabel(String value) {
  switch (value) {
    case 'FIVE_X_FIVE':
      return '5x5';
    case 'SEVEN_X_SEVEN':
      return '7x7';
    case 'ELEVEN_X_ELEVEN':
      return '11x11';
    default:
      return value;
  }
}

String _skillLabel(String value) {
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

Widget _infoRow(String label, String value) {
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      children: [
        SizedBox(
            width: 100,
            child: Text(label, style: const TextStyle(color: Colors.black54))),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        )
      ],
    ),
  );
}
