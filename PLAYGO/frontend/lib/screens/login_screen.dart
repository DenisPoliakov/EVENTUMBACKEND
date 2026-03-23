import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:playgo/models/user.dart';
import 'package:playgo/services/api_client.dart';
import 'package:playgo/theme/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen(
      {super.key,
      required this.api,
      required this.onLoggedIn,
      required this.onSwitchToRegister,
      this.externalError});

  final ApiClient api;
  final void Function(String token, User user) onLoggedIn;
  final VoidCallback onSwitchToRegister;
  final String? externalError;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _identifierCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await widget.api.login(
        identifier: _identifierCtrl.text.trim(),
        password: _passwordCtrl.text,
      );
      final token = res['accessToken'] as String;
      final user = User.fromJson(res['user'] as Map<String, dynamic>);
      widget.onLoggedIn(token, user);
    } on ApiException catch (e) {
      if (e.code == 403) {
        setState(() => _error = _formatBlockedMessage(e.message));
      } else {
        setState(() => _error = e.message);
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  String _formatBlockedMessage(String message) {
    final match = RegExp(r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d+Z|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)')
        .firstMatch(message);
    if (match == null) return message;
    final raw = match.group(0);
    if (raw == null) return message;
    try {
      final dt = DateTime.parse(raw).toLocal();
      final formatted = DateFormat('dd.MM.yyyy HH:mm').format(dt);
      return message.replaceFirst(raw, formatted);
    } catch (_) {
      return message;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 24),
              Text('С возвращением',
                  style: Theme.of(context)
                      .textTheme
                      .headlineMedium
                      ?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text('Войди по email или логину и паролю',
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(color: Colors.black54)),
              const SizedBox(height: 24),
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
              if (_error == null && widget.externalError != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Text(widget.externalError!,
                      style: const TextStyle(
                          color: Colors.red, fontWeight: FontWeight.w600)),
                ),
              if (_error == null && widget.externalError != null)
                const SizedBox(height: 12),
              Form(
                key: _formKey,
                child: Column(
                  children: [
                    TextFormField(
                      controller: _identifierCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Email или логин',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty)
                          ? 'Введите email или логин'
                          : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _passwordCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Пароль',
                        prefixIcon: Icon(Icons.lock_outline),
                      ),
                      obscureText: true,
                      validator: (v) => (v == null || v.length < 6)
                          ? 'Минимум 6 символов'
                          : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _loading ? null : _submit,
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
                      : const Text('Войти',
                          style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(height: 14),
              TextButton(
                onPressed: _loading ? null : widget.onSwitchToRegister,
                child: const Text('Нет аккаунта? Зарегистрироваться'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
