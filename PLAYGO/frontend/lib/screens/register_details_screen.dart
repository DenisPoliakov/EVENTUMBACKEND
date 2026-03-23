import 'package:flutter/material.dart';
import 'package:playgo/models/user.dart';
import 'package:playgo/services/api_client.dart';
import 'package:playgo/theme/app_theme.dart';
import 'package:playgo/services/city_repository.dart';
import 'package:playgo/widgets/city_field.dart';

class RegisterDetailsScreen extends StatefulWidget {
  const RegisterDetailsScreen({
    super.key,
    required this.email,
    required this.username,
    required this.password,
    required this.api,
    required this.onRegistered,
  });

  final String email;
  final String username;
  final String password;
  final ApiClient api;
  final void Function(String token, User user) onRegistered;

  @override
  State<RegisterDetailsScreen> createState() => _RegisterDetailsScreenState();
}

class _RegisterDetailsScreenState extends State<RegisterDetailsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  late final Future<List<String>> _citiesFuture =
      CityRepository.instance.load();
  bool _loading = false;
  bool _registered = false;
  bool _confirmedAdult = false;
  String? _error;

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _cityCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_loading || _registered) return;
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await widget.api.register(
        email: widget.email,
        username: widget.username,
        password: widget.password,
        firstName: _firstNameCtrl.text.trim(),
        lastName: _lastNameCtrl.text.trim(),
        city: _cityCtrl.text.trim(),
      );
      final token = res['accessToken'] as String;
      final user = User.fromJson(res['user'] as Map<String, dynamic>);
      _registered = true;
      widget.onRegistered(token, user);
      if (!mounted) return;
      Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Продолжаем регистрацию')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Заполни данные профиля',
                  style: Theme.of(context)
                      .textTheme
                      .headlineSmall
                      ?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text('Имя, фамилия и город понадобятся в профиле и матчах.',
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(color: Colors.black54)),
              const SizedBox(height: 20),
              if (_error != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Text(_error!,
                      style: const TextStyle(
                          color: Colors.red, fontWeight: FontWeight.w600)),
                ),
              if (_error != null) const SizedBox(height: 12),
              Form(
                key: _formKey,
                child: FutureBuilder<List<String>>(
                  future: _citiesFuture,
                  builder: (context, snapshot) {
                    final cities = snapshot.data;
                    return Column(
                      children: [
                        TextFormField(
                          controller: _firstNameCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Имя',
                            prefixIcon: Icon(Icons.badge_outlined),
                          ),
                          validator: (v) => (v == null || v.trim().isEmpty)
                              ? 'Введите имя'
                              : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _lastNameCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Фамилия',
                            prefixIcon: Icon(Icons.badge),
                          ),
                          validator: (v) => (v == null || v.trim().isEmpty)
                              ? 'Введите фамилию'
                              : null,
                        ),
                        const SizedBox(height: 12),
                        if (cities == null)
                          const Center(child: CircularProgressIndicator())
                        else
                          CityField(
                            controller: _cityCtrl,
                            cities: cities,
                            label: 'Город',
                          ),
                      ],
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7E8),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFF2C46D)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Checkbox(
                      value: _confirmedAdult,
                      activeColor: accentColor,
                      onChanged: (value) {
                        setState(() => _confirmedAdult = value ?? false);
                      },
                    ),
                    const SizedBox(width: 4),
                    const Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(top: 10),
                        child: Text(
                          'Подтверждаю, что мне исполнилось 18 лет.',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF6B4B00),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed:
                      (_loading || !_confirmedAdult) ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accentColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _loading
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : const Text('Завершить'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
