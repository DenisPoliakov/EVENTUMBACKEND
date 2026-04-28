import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'models/player_card.dart';
import 'models/team_models.dart';
import 'models/user.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/map_screen.dart';
import 'screens/leaderboard_screen.dart';
import 'screens/player_card_editor_screen.dart';
import 'screens/players_screen.dart';
import 'screens/news_screen.dart';
import 'screens/register_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/team_screen.dart';
import 'services/api_client.dart';
import 'services/admin_api.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const PlayGoApp());
}

class PlayGoApp extends StatefulWidget {
  const PlayGoApp({super.key});

  @override
  State<PlayGoApp> createState() => _PlayGoAppState();
}

class _PlayGoAppState extends State<PlayGoApp> with WidgetsBindingObserver {
  final GlobalKey<NavigatorState> _navKey = GlobalKey<NavigatorState>();
  final ApiClient _api = ApiClient();
  User? _user;
  String? _token;
  bool _loading = true;
  bool _showRegister = false;
  int _tab = 0;
  String? _sessionError;
  Timer? _statusTimer;
  PlayerCard? _playerCard;
  TeamSummary? _team;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _restoreSession();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _statusTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshCurrentUser();
    }
  }

  Future<void> _restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token == null) {
      setState(() => _loading = false);
      return;
    }
    try {
      final me = await _api.me(token);
      final playerCard = await _api.myPlayerCard(token);
      final team = await _api.myTeam(token);
      final user = User.fromJson((me['user'] ?? {}) as Map<String, dynamic>);
      setState(() {
        _token = token;
        _user = user;
        _playerCard = playerCard;
        _team = team;
        _loading = false;
        _sessionError = null;
      });
      _startStatusPolling();
    } catch (_) {
      await prefs.remove('token');
      setState(() => _loading = false);
    }
  }

  Future<void> _handleLoggedIn(String token, User user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);
    setState(() {
      _token = token;
      _user = user;
      _playerCard = null;
      _team = null;
      _tab = 0;
      _sessionError = null;
    });
    await _refreshPlayerCard();
    await _refreshTeam();
    _startStatusPolling();
  }

  Future<void> _logout({String? reason}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    _statusTimer?.cancel();
    setState(() {
      _token = null;
      _user = null;
      _playerCard = null;
      _team = null;
      _showRegister = false;
      _sessionError = reason;
    });
  }

  void _startStatusPolling() {
    _statusTimer?.cancel();
    if (_token == null) return;
    _statusTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      _refreshCurrentUser();
    });
  }

  Future<void> _refreshCurrentUser() async {
    final token = _token;
    if (token == null) return;
    try {
      final me = await _api.me(token);
      final playerCard = await _api.myPlayerCard(token);
      final team = await _api.myTeam(token);
      final user = User.fromJson((me['user'] ?? {}) as Map<String, dynamic>);
      if (!mounted) return;
      setState(() {
        _user = user;
        _playerCard = playerCard;
        _team = team;
        _sessionError = null;
      });
    } on ApiException catch (e) {
      if (e.code == 403) {
        await _logout(reason: _formatSessionBlockMessage(e.message));
      }
    } catch (_) {}
  }

  Future<void> _refreshPlayerCard() async {
    final token = _token;
    if (token == null) return;
    try {
      final playerCard = await _api.myPlayerCard(token);
      if (!mounted) return;
      setState(() => _playerCard = playerCard);
    } catch (_) {}
  }

  Future<void> _refreshTeam() async {
    final token = _token;
    if (token == null) return;
    try {
      final team = await _api.myTeam(token);
      if (!mounted) return;
      setState(() => _team = team);
    } catch (_) {}
  }

  String _formatSessionBlockMessage(String message) {
    final exp = RegExp(r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)')
        .firstMatch(message);
    if (exp == null) return message;
    final raw = exp.group(0);
    if (raw == null) return message;
    try {
      final dt = DateTime.parse(raw).toLocal();
      final formatted =
          '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      return message.replaceFirst(raw, formatted);
    } catch (_) {
      return message;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: lightTheme(),
        home: const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    final loggedIn = _user != null && _token != null;

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      navigatorKey: _navKey,
      title: 'PlayGO',
      theme: lightTheme(),
      darkTheme: darkTheme(),
      home: loggedIn
          ? Scaffold(
              body: IndexedStack(
                index: _tab,
                children: [
                  HomeScreen(user: _user!),
                  MapScreen(user: _user!),
                  NewsScreen(api: AdminApi()),
                  PlayersScreen(userCity: _user!.city),
                  const LeaderboardScreen(),
                  ProfileScreen(
                    user: _user!,
                    playerCard: _playerCard,
                    team: _team,
                    onLogout: _logout,
                    onOpenSettings: () async {
                      final updated = await _navKey.currentState?.push<User>(
                        MaterialPageRoute(
                          builder: (_) => SettingsScreen(
                            user: _user!,
                            token: _token!,
                            api: _api,
                            onUserUpdated: (u) =>
                                Navigator.of(_navKey.currentContext!).pop(u),
                          ),
                        ),
                      );
                      if (updated != null) {
                        final prefs = await SharedPreferences.getInstance();
                        setState(() => _user = updated);
                        await prefs.setString('token', _token!);
                      }
                    },
                    onOpenPlayerCard: () async {
                      final updated =
                          await _navKey.currentState?.push<PlayerCard>(
                        MaterialPageRoute(
                          builder: (_) => PlayerCardEditorScreen(
                            api: _api,
                            token: _token!,
                            initialCard: _playerCard,
                          ),
                        ),
                      );
                      if (updated != null) {
                        setState(() => _playerCard = updated);
                        await _refreshCurrentUser();
                      }
                    },
                    onOpenTeam: () async {
                      await _navKey.currentState?.push(
                        MaterialPageRoute(
                          builder: (_) => TeamScreen(
                            api: _api,
                            token: _token!,
                            userId: _user!.id,
                          ),
                        ),
                      );
                      await _refreshTeam();
                    },
                  ),
                ],
              ),
              bottomNavigationBar: BottomNavigationBar(
                currentIndex: _tab,
                onTap: (i) => setState(() => _tab = i),
                items: const [
                  BottomNavigationBarItem(
                    icon: Icon(Icons.home_outlined),
                    activeIcon: Icon(Icons.home_rounded),
                    label: 'Главная',
                  ),
                  BottomNavigationBarItem(
                    icon: Icon(Icons.map_outlined),
                    activeIcon: Icon(Icons.map_rounded),
                    label: 'Карта',
                  ),
                  BottomNavigationBarItem(
                    icon: Icon(Icons.newspaper_outlined),
                    activeIcon: Icon(Icons.newspaper),
                    label: 'Новости',
                  ),
                  BottomNavigationBarItem(
                    icon: Icon(Icons.groups_2_outlined),
                    activeIcon: Icon(Icons.groups_2_rounded),
                    label: 'Игроки',
                  ),
                  BottomNavigationBarItem(
                    icon: Icon(Icons.bar_chart_outlined),
                    activeIcon: Icon(Icons.bar_chart_rounded),
                    label: 'Лидерборд',
                  ),
                  BottomNavigationBarItem(
                    icon: Icon(Icons.person_outline),
                    activeIcon: Icon(Icons.person),
                    label: 'Профиль',
                  ),
                ],
              ),
            )
          : _showRegister
              ? RegisterScreen(
                  api: _api,
                  onRegistered: _handleLoggedIn,
                  onSwitchToLogin: () => setState(() => _showRegister = false),
                )
              : LoginScreen(
                  api: _api,
                  externalError: _sessionError,
                  onLoggedIn: _handleLoggedIn,
                  onSwitchToRegister: () =>
                      setState(() => _showRegister = true),
                ),
    );
  }
}
