import 'package:flutter/material.dart';
import 'package:playgo/models/team_models.dart';
import 'package:playgo/models/user.dart';
import 'package:playgo/services/api_client.dart';
import 'package:playgo/services/admin_api.dart';
import 'package:playgo/theme/app_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'stadium_matches_screen.dart';

class StadiumMatchesBlock extends StatefulWidget {
  const StadiumMatchesBlock(
      {super.key,
      required this.api,
      required this.cityName,
      required this.user});
  final AdminApi api;
  final String cityName;
  final User user;

  @override
  State<StadiumMatchesBlock> createState() => _StadiumMatchesBlockState();
}

class _StadiumMatchesBlockState extends State<StadiumMatchesBlock> {
  late Future<List<_StadiumWithMatch>> _data;
  final ApiClient _accountApi = ApiClient();

  @override
  void initState() {
    super.initState();
    _data = _load();
  }

  Future<void> _reload() async {
    setState(() {
      _data = _load();
    });
    await _data;
  }

  Future<List<_StadiumWithMatch>> _load() async {
    final stadiums = await widget.api.fetchStadiums(widget.cityName);

    // помечаем, есть ли одобренная заявка пользователя на матч этого стадиона
    final login =
        widget.user.email.isNotEmpty ? widget.user.email : widget.user.username;
    TeamSummary? team;
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token != null) {
      try {
        team = await _accountApi.myTeam(token);
      } catch (_) {}
    }
    Map<String, bool> approvedByStadium = {};
    if (login.isNotEmpty || (team?.id.isNotEmpty ?? false)) {
      final regs = await widget.api.fetchRegistrations(
          captainLogin: login,
          teamId: team?.id,
          status: 'APPROVED',
          matchId: null);
      for (final r in regs) {
        // нам нужно понять стадион матча — быстрый путь: запросить матч
        final match = await widget.api.fetchMatchById(r.matchId);
        if (match != null) {
          approvedByStadium[match.stadiumId ?? ''] = true;
        }
      }
    }

    return stadiums
        .map((s) => _StadiumWithMatch(
            stadium: s, hasOwnApproved: approvedByStadium[s.id] == true))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _reload,
      child: FutureBuilder<List<_StadiumWithMatch>>(
        future: _data,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          if (snap.hasError) {
            return ListView(
              shrinkWrap: true,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    'Не удалось загрузить стадионы: ${snap.error}',
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
              ],
            );
          }
          final data = snap.data ?? [];
          if (data.isEmpty) {
            return ListView(
              shrinkWrap: true,
              children: const [
                Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Text('Стадионы не найдены для выбранного города'),
                ),
              ],
            );
          }
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            shrinkWrap: true,
            children: data
                .map((item) => _StadiumCard(
                    item: item, api: widget.api, user: widget.user))
                .toList(),
          );
        },
      ),
    );
  }
}

class _StadiumWithMatch {
  final Stadium stadium;
  final bool hasOwnApproved;
  _StadiumWithMatch({required this.stadium, required this.hasOwnApproved});
}

class _StadiumCard extends StatelessWidget {
  const _StadiumCard(
      {required this.item, required this.api, required this.user});

  final _StadiumWithMatch item;
  final AdminApi api;
  final User user;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StadiumImage(url: item.stadium.imageUrl),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (item.hasOwnApproved)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: const [
                        Icon(Icons.check_circle, color: Colors.green, size: 18),
                        SizedBox(width: 6),
                        Text('Вы приняты на один из матчей',
                            style: TextStyle(
                                color: Colors.green,
                                fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                Text(item.stadium.name,
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(item.stadium.address,
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: Colors.black54)),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: () {
                      Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => StadiumMatchesScreen(
                            api: api, stadium: item.stadium, user: user),
                      ));
                    },
                    child: const Text('Посмотреть доступные матчи'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StadiumImage extends StatelessWidget {
  const _StadiumImage({required this.url});
  final String url;

  @override
  Widget build(BuildContext context) {
    if (url.startsWith('http')) {
      return AspectRatio(
        aspectRatio: 16 / 9,
        child: Image.network(
          url,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
              color: accentColor.withOpacity(0.12),
              child: const Icon(Icons.stadium_rounded, color: accentColor)),
        ),
      );
    }
    return Container(
      height: 140,
      color: accentColor.withOpacity(0.12),
      child:
          const Center(child: Icon(Icons.stadium_rounded, color: accentColor)),
    );
  }
}
