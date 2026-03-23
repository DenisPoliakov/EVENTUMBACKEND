import 'package:flutter/material.dart';
import 'package:playgo/models/user.dart';
import 'package:playgo/services/admin_api.dart';

import 'home_screen_stadiums.dart';
import 'notifications_screen.dart';

class HomeScreen extends StatelessWidget {
  HomeScreen({super.key, required this.user});

  final User user;
  final _api = AdminApi();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Главная'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none_rounded),
            onPressed: () {
              Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => NotificationsScreen(user: user, api: _api),
              ));
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: ListView(
            children: [
              Text(
                'Город: ${user.city.isEmpty ? 'не указан' : user.city}',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              Text('Доступные стадионы и матчи',
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              StadiumMatchesBlock(
                api: _api,
                cityName: user.city,
                user: user,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
