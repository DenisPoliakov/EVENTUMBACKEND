import 'package:flutter/material.dart';
import 'package:playgo/models/user.dart';
import 'package:playgo/services/api_client.dart';
import 'package:playgo/theme/app_theme.dart';
import 'package:playgo/services/city_repository.dart';
import 'package:playgo/widgets/city_field.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.user,
    required this.token,
    required this.api,
    required this.onUserUpdated,
  });

  final User user;
  final String token;
  final ApiClient api;
  final void Function(User user) onUserUpdated;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

enum PassStage { hidden, current, newPass }

class _SettingsScreenState extends State<SettingsScreen> {
  late TextEditingController _email;
  late TextEditingController _firstName;
  late TextEditingController _lastName;
  late TextEditingController _city;
  late final Future<List<String>> _citiesFuture =
      CityRepository.instance.load();
  late FocusNode _emailFocus;
  late FocusNode _firstFocus;
  late FocusNode _lastFocus;
  late FocusNode _cityFocus;

  bool _editEmail = false;
  bool _editFirst = false;
  bool _editLast = false;
  bool _editCity = false;
  bool _saving = false;
  String? _error;

  final _formKey = GlobalKey<FormState>();

  PassStage _passStage = PassStage.hidden;
  final _currentPass = TextEditingController();
  final _newPass = TextEditingController();
  final _confirmPass = TextEditingController();
  bool _savingPass = false;
  String? _passError;
  String? _passOk;
  String _validatedCurrent = '';

  @override
  void initState() {
    super.initState();
    _email = TextEditingController(text: widget.user.email);
    _firstName = TextEditingController(text: widget.user.firstName);
    _lastName = TextEditingController(text: widget.user.lastName);
    _city = TextEditingController(text: widget.user.city);
    _emailFocus = FocusNode();
    _firstFocus = FocusNode();
    _lastFocus = FocusNode();
    _cityFocus = FocusNode();
  }

  @override
  void dispose() {
    _email.dispose();
    _firstName.dispose();
    _lastName.dispose();
    _city.dispose();
    _emailFocus.dispose();
    _firstFocus.dispose();
    _lastFocus.dispose();
    _cityFocus.dispose();
    _currentPass.dispose();
    _newPass.dispose();
    _confirmPass.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final res = await widget.api.updateProfile(
        token: widget.token,
        email: _email.text.trim(),
        firstName: _firstName.text.trim(),
        lastName: _lastName.text.trim(),
        city: _city.text.trim(),
      );
      final user = User.fromJson(res['user'] as Map<String, dynamic>);
      widget.onUserUpdated(user);
      setState(() {
        _editEmail = _editFirst = _editLast = _editCity = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Профиль обновлён')),
      );
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _saving = false);
    }
  }

  Future<void> _changePassword() async {
    if (_savingPass) return;
    setState(() {
      _savingPass = true;
      _passError = null;
      _passOk = null;
    });
    try {
      if (_passStage == PassStage.current) {
        if (_currentPass.text.isEmpty) {
          setState(() => _passError = 'Введите текущий пароль');
          return;
        }
        await widget.api.checkPassword(
          token: widget.token,
          password: _currentPass.text,
        );
        setState(() {
          _validatedCurrent = _currentPass.text;
          _passStage = PassStage.newPass;
        });
        return;
      }

      if (_newPass.text.length < 6) {
        setState(() => _passError = 'Новый пароль минимум 6 символов');
        return;
      }
      if (_newPass.text != _confirmPass.text) {
        setState(() => _passError = 'Пароли не совпадают');
        return;
      }

      await widget.api.changePassword(
        token: widget.token,
        oldPassword: _validatedCurrent,
        newPassword: _newPass.text,
      );
      setState(() {
        _passOk = 'Пароль обновлён';
        _passStage = PassStage.hidden;
        _validatedCurrent = '';
      });
      _currentPass.clear();
      _newPass.clear();
      _confirmPass.clear();
    } catch (e) {
      setState(() => _passError = e.toString());
    } finally {
      setState(() => _savingPass = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Настройки аккаунта')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_error != null) _errorBox(_error!),
            Form(
              key: _formKey,
              child: Column(
                children: [
                  _editableField(
                    label: 'Email',
                    controller: _email,
                    focusNode: _emailFocus,
                    editable: _editEmail,
                    onToggle: () => setState(() {
                      _editEmail = !_editEmail;
                      if (_editEmail) {
                        _emailFocus.requestFocus();
                        _email.selection = TextSelection.fromPosition(
                            TextPosition(offset: _email.text.length));
                      } else {
                        _emailFocus.unfocus();
                      }
                    }),
                    validator: (v) =>
                        (v == null || v.isEmpty) ? 'Введите email' : null,
                  ),
                  _editableField(
                    label: 'Имя',
                    controller: _firstName,
                    focusNode: _firstFocus,
                    editable: _editFirst,
                    onToggle: () => setState(() {
                      _editFirst = !_editFirst;
                      if (_editFirst) {
                        _firstFocus.requestFocus();
                        _firstName.selection = TextSelection.fromPosition(
                            TextPosition(offset: _firstName.text.length));
                      } else {
                        _firstFocus.unfocus();
                      }
                    }),
                  ),
                  _editableField(
                    label: 'Фамилия',
                    controller: _lastName,
                    focusNode: _lastFocus,
                    editable: _editLast,
                    onToggle: () => setState(() {
                      _editLast = !_editLast;
                      if (_editLast) {
                        _lastFocus.requestFocus();
                        _lastName.selection = TextSelection.fromPosition(
                            TextPosition(offset: _lastName.text.length));
                      } else {
                        _lastFocus.unfocus();
                      }
                    }),
                  ),
                  FutureBuilder<List<String>>(
                    future: _citiesFuture,
                    builder: (context, snapshot) {
                      final cities = snapshot.data;
                      if (cities == null) {
                        return const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }
                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: CityField(
                              controller: _city,
                              cities: cities,
                              enabled: _editCity,
                              label: 'Город',
                            ),
                          ),
                          IconButton(
                            icon: Icon(
                                _editCity ? Icons.close : Icons.edit_outlined),
                            onPressed: () =>
                                setState(() => _editCity = !_editCity),
                            tooltip: _editCity ? 'Готово' : 'Редактировать',
                          ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _saving ? null : _saveProfile,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accentColor,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _saving
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(
                                  color: Colors.white, strokeWidth: 2))
                          : const Text('Сохранить'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text('Смена пароля',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
            const SizedBox(height: 12),
            if (_passError != null) _errorBox(_passError!),
            if (_passOk != null)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(10)),
                child: Text(_passOk!,
                    style: const TextStyle(
                        color: Colors.green, fontWeight: FontWeight.w700)),
              ),
            const SizedBox(height: 8),
            if (_passStage == PassStage.hidden)
              OutlinedButton(
                onPressed: () => setState(() {
                  _passStage = PassStage.current;
                  _passError = null;
                  _passOk = null;
                }),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Сменить пароль'),
              )
            else ...[
              TextFormField(
                controller: _currentPass,
                decoration: const InputDecoration(
                  labelText: 'Текущий пароль',
                  prefixIcon: Icon(Icons.lock_clock_outlined),
                ),
                obscureText: true,
              ),
              const SizedBox(height: 12),
              if (_passStage == PassStage.newPass) ...[
                TextFormField(
                  controller: _newPass,
                  decoration: const InputDecoration(
                    labelText: 'Новый пароль',
                    prefixIcon: Icon(Icons.lock_reset),
                  ),
                  obscureText: true,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _confirmPass,
                  decoration: const InputDecoration(
                    labelText: 'Подтвердите пароль',
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                  obscureText: true,
                ),
                const SizedBox(height: 12),
              ],
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _savingPass ? null : _changePassword,
                  style: ElevatedButton.styleFrom(
                    backgroundColor:
                        _passStage == PassStage.newPass ? accentColor : null,
                    foregroundColor:
                        _passStage == PassStage.newPass ? Colors.white : null,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _savingPass
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(_passStage == PassStage.current
                          ? 'Проверить'
                          : 'Сохранить новый пароль'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _editableField({
    required String label,
    required TextEditingController controller,
    required FocusNode focusNode,
    required bool editable,
    required VoidCallback onToggle,
    String? Function(String?)? validator,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: TextFormField(
              controller: controller,
              focusNode: focusNode,
              readOnly: !editable,
              decoration: InputDecoration(
                labelText: label,
                suffixIcon: IconButton(
                  icon: Icon(editable ? Icons.close : Icons.edit_outlined),
                  onPressed: onToggle,
                  tooltip: editable ? 'Готово' : 'Редактировать',
                ),
              ),
              validator: validator,
            ),
          ),
        ],
      ),
    );
  }

  Widget _errorBox(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Text(message,
          style:
              const TextStyle(color: Colors.red, fontWeight: FontWeight.w600)),
    );
  }
}
