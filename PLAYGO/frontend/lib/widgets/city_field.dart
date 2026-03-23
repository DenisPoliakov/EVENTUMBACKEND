import 'package:flutter/material.dart';

class CityField extends StatefulWidget {
  const CityField({
    super.key,
    required this.controller,
    required this.cities,
    this.enabled = true,
    this.label = 'Город',
  });

  final TextEditingController controller;
  final List<String> cities;
  final bool enabled;
  final String label;

  @override
  State<CityField> createState() => _CityFieldState();
}

class _CityFieldState extends State<CityField> {
  late final Set<String> _citiesLower =
      widget.cities.map((e) => e.toLowerCase()).toSet();

  @override
  Widget build(BuildContext context) {
    return RawAutocomplete<String>(
      textEditingController: widget.controller,
      focusNode: FocusNode(),
      optionsBuilder: (text) {
        if (!widget.enabled) return const Iterable<String>.empty();
        final q = text.text.toLowerCase();
        if (q.isEmpty) return widget.cities.take(10);
        return widget.cities
            .where((c) => c.toLowerCase().startsWith(q))
            .take(10);
      },
      onSelected: (val) => widget.controller.text = val,
      fieldViewBuilder: (context, textCtrl, focusNode, onFieldSubmitted) {
        textCtrl.text = widget.controller.text;
        textCtrl.selection =
            TextSelection.collapsed(offset: widget.controller.text.length);
        return TextFormField(
          controller: textCtrl,
          focusNode: focusNode,
          readOnly: !widget.enabled,
          decoration: InputDecoration(
            labelText: widget.label,
            suffixIcon: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_drop_down_circle_outlined),
                  onPressed: widget.enabled
                      ? () => _showPicker(context, textCtrl)
                      : null,
                ),
                if (widget.enabled && textCtrl.text.isNotEmpty)
                  IconButton(
                    icon: const Icon(Icons.clear),
                    onPressed: () => setState(() => textCtrl.clear()),
                  ),
              ],
            ),
          ),
          validator: (v) {
            final val = v?.trim() ?? '';
            if (val.isEmpty) return 'Введите город';
            if (!_citiesLower.contains(val.toLowerCase())) {
              return 'Некорректный выбор города';
            }
            return null;
          },
          onChanged: (val) => widget.controller.text = val,
        );
      },
      optionsViewBuilder: (context, onSelected, options) {
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(12),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 220, minWidth: 280),
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: options.length,
                itemBuilder: (context, index) {
                  final option = options.elementAt(index);
                  return ListTile(
                    dense: true,
                    title: Text(option),
                    onTap: () => onSelected(option),
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _showPicker(
      BuildContext context, TextEditingController ctrl) async {
    if (!widget.enabled) return;
    final selected = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            children: [
              Container(
                width: 44,
                height: 4,
                margin: const EdgeInsets.only(top: 8, bottom: 4),
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              const Padding(
                padding: EdgeInsets.all(12),
                child: Text('Выберите город',
                    style:
                        TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              ),
              Expanded(
                child: ListView.separated(
                  itemCount: widget.cities.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final city = widget.cities[index];
                    return ListTile(
                      title: Text(city),
                      onTap: () => Navigator.of(context).pop(city),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
    if (selected != null) {
      setState(() {
        ctrl.text = selected;
        widget.controller.text = selected;
      });
    }
  }
}
