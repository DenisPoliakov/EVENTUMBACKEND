import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:playgo/models/player_card.dart';
import 'package:playgo/services/api_client.dart';
import 'package:playgo/theme/app_theme.dart';

class PlayerCardEditorScreen extends StatefulWidget {
  const PlayerCardEditorScreen({
    super.key,
    required this.api,
    required this.token,
    this.initialCard,
  });

  final ApiClient api;
  final String token;
  final PlayerCard? initialCard;

  @override
  State<PlayerCardEditorScreen> createState() => _PlayerCardEditorScreenState();
}

class _PlayerCardEditorScreenState extends State<PlayerCardEditorScreen> {
  late final TextEditingController _heightCtrl;
  late final TextEditingController _weightCtrl;
  late final TextEditingController _ageCtrl;
  late final TextEditingController _bioCtrl;
  late final TextEditingController _ratingCtrl;

  PlayerCardOptions? _options;
  String? _position;
  String? _preferredFoot;
  String? _favoriteFormat;
  final List<String> _skills = [];
  final List<String> _statuses = [];
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String _avatarUrl = '';

  @override
  void initState() {
    super.initState();
    final card = widget.initialCard;
    _heightCtrl = TextEditingController(text: card?.heightCm?.toString() ?? '');
    _weightCtrl = TextEditingController(text: card?.weightKg?.toString() ?? '');
    _ageCtrl = TextEditingController(text: card?.age?.toString() ?? '');
    _bioCtrl = TextEditingController(text: card?.bio ?? '');
    _ratingCtrl = TextEditingController(text: (card?.rating ?? 70).toString());
    _position = card?.position;
    _preferredFoot = card?.preferredFoot;
    _favoriteFormat = card?.favoriteFormat;
    _skills.addAll(card?.skillTags ?? const []);
    _statuses.addAll(card?.statuses ?? const []);
    _avatarUrl = card?.avatarUrl ?? '';
    _loadOptions();
  }

  @override
  void dispose() {
    _heightCtrl.dispose();
    _weightCtrl.dispose();
    _ageCtrl.dispose();
    _bioCtrl.dispose();
    _ratingCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadOptions() async {
    try {
      final options = await widget.api.playerCardOptions();
      if (!mounted) return;
      setState(() {
        _options = options;
        _position ??=
            options.positions.isNotEmpty ? options.positions.first : null;
        _preferredFoot ??=
            options.preferredFeet.length > 1 ? options.preferredFeet[1] : null;
        _favoriteFormat ??=
            options.formats.length > 1 ? options.formats[1] : null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _pickAvatar() async {
    try {
      final picker = ImagePicker();
      final image = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1200,
        imageQuality: 85,
      );
      if (image == null) return;
      setState(() => _saving = true);
      final url = await widget.api.uploadPlayerAvatar(
        token: widget.token,
        file: File(image.path),
      );
      if (!mounted) return;
      setState(() => _avatarUrl = url);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Не удалось загрузить фото: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _toggleLimited(List<String> selected, String value) {
    setState(() {
      if (selected.contains(value)) {
        selected.remove(value);
      } else if (selected.length < 3) {
        selected.add(value);
      }
    });
  }

  Future<void> _save() async {
    if (_position == null ||
        _preferredFoot == null ||
        _favoriteFormat == null) {
      setState(() => _error = 'Выбери позицию, ведущую ногу и формат');
      return;
    }
    if (_skills.isEmpty) {
      setState(() => _error = 'Выбери хотя бы одну сильную сторону');
      return;
    }
    if (_statuses.isEmpty) {
      setState(() => _error = 'Выбери хотя бы один статус');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final card = await widget.api.saveMyPlayerCard(
        token: widget.token,
        payload: {
          'position': _position,
          'preferredFoot': _preferredFoot,
          'favoriteFormat': _favoriteFormat,
          'heightCm': _heightCtrl.text.trim(),
          'weightKg': _weightCtrl.text.trim(),
          'age': _ageCtrl.text.trim(),
          'bio': _bioCtrl.text.trim(),
          'avatarUrl': _avatarUrl,
          'skillTags': _skills,
          'statuses': _statuses,
          'rating': _ratingCtrl.text.trim(),
        },
      );
      if (!mounted) return;
      Navigator.of(context).pop(card);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    final options = _options;
    if (options == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Карточка футболиста')),
        body: Center(child: Text(_error ?? 'Не удалось загрузить настройки')),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.initialCard == null
            ? 'Создать карточку футболиста'
            : 'Редактировать карточку'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_error != null)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Text(
                  _error!,
                  style: TextStyle(
                    color: Colors.red.shade800,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            if (_error != null) const SizedBox(height: 16),
            Center(
              child: GestureDetector(
                onTap: _saving ? null : _pickAvatar,
                child: CircleAvatar(
                  radius: 42,
                  backgroundColor: accentColor.withOpacity(0.12),
                  backgroundImage: _avatarUrl.isNotEmpty
                      ? NetworkImage('${widget.api.baseUrl}$_avatarUrl')
                      : null,
                  child: _avatarUrl.isEmpty
                      ? const Icon(
                          Icons.add_a_photo_outlined,
                          size: 28,
                          color: accentColor,
                        )
                      : null,
                ),
              ),
            ),
            Center(
              child: TextButton(
                onPressed: _saving ? null : _pickAvatar,
                child: const Text('Загрузить фото'),
              ),
            ),
            const SizedBox(height: 8),
            _dropdown(
              label: 'Позиция',
              value: _position,
              items: options.positions,
              onChanged: (value) => setState(() => _position = value),
              labelBuilder: playerPositionLabel,
            ),
            const SizedBox(height: 12),
            _dropdown(
              label: 'Ведущая нога',
              value: _preferredFoot,
              items: options.preferredFeet,
              onChanged: (value) => setState(() => _preferredFoot = value),
              labelBuilder: playerFootLabel,
            ),
            const SizedBox(height: 12),
            _dropdown(
              label: 'Любимый формат',
              value: _favoriteFormat,
              items: options.formats,
              onChanged: (value) => setState(() => _favoriteFormat = value),
              labelBuilder: playerFormatLabel,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _ratingCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Рейтинг',
                helperText: 'Самооценка от 40 до 99',
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _heightCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Рост, см'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _weightCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Вес, кг'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _ageCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Возраст'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _bioCtrl,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'Краткое био',
                hintText: 'Например: цепкий опорник, люблю высокий прессинг',
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Сильные стороны',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            const SizedBox(height: 4),
            const Text('Выбери до 3', style: TextStyle(color: Colors.black54)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: options.skillTags
                  .map(
                    (item) => FilterChip(
                      selected: _skills.contains(item),
                      label: Text(playerSkillLabel(item)),
                      onSelected: (_) => _toggleLimited(_skills, item),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 16),
            const Text(
              'Статус игрока',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            const SizedBox(height: 4),
            const Text('Выбери до 3', style: TextStyle(color: Colors.black54)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: options.statuses
                  .map(
                    (item) => FilterChip(
                      selected: _statuses.contains(item),
                      label: Text(playerStatusLabel(item)),
                      onSelected: (_) => _toggleLimited(_statuses, item),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _saving ? null : _save,
              style: ElevatedButton.styleFrom(
                backgroundColor: accentColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Сохранить карточку'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dropdown({
    required String label,
    required String? value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
    required String Function(String value) labelBuilder,
  }) {
    return DropdownButtonFormField<String>(
      value: value,
      items: items
          .map(
            (item) => DropdownMenuItem<String>(
              value: item,
              child: Text(labelBuilder(item)),
            ),
          )
          .toList(),
      onChanged: onChanged,
      decoration: InputDecoration(labelText: label),
    );
  }
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

String playerFootLabel(String value) {
  switch (value) {
    case 'LEFT':
      return 'Левая';
    case 'RIGHT':
      return 'Правая';
    case 'BOTH':
      return 'Обе';
    default:
      return value;
  }
}

String playerFormatLabel(String value) {
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
