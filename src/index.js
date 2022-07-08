import React, { PureComponent } from 'react';
import { Keyboard, Modal, Platform, Text, TextInput, TouchableOpacity, View, Dimensions } from 'react-native';
import PropTypes from 'prop-types';
import isEqual from 'lodash.isequal';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment';
import { defaultStyles } from './styles';

export default class RNPickerSelect extends PureComponent {
    static propTypes = {
        onValueChange: PropTypes.func.isRequired,
        items: PropTypes.oneOfType([
            PropTypes.arrayOf(
                PropTypes.shape({
                    label: PropTypes.string.isRequired,
                    value: PropTypes.any.isRequired,
                    inputLabel: PropTypes.string,
                    key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
                    color: PropTypes.string,
                })
            ),
            PropTypes.arrayOf(
                PropTypes.arrayOf(
                    PropTypes.shape({
                    label: PropTypes.string.isRequired,
                    value: PropTypes.any.isRequired,
                    inputLabel: PropTypes.string,
                    key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
                    color: PropTypes.string,
                })
            )
        )]
        ).isRequired,
        labels: PropTypes.array,
        placeholder: PropTypes.shape({
            label: PropTypes.string,
            value: PropTypes.any,
            key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            color: PropTypes.string,
        }),
        disabled: PropTypes.bool,
        itemKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        style: PropTypes.shape({}),
        children: PropTypes.any, // eslint-disable-line react/forbid-prop-types
        onOpen: PropTypes.func,
        useNativeAndroidPickerStyle: PropTypes.bool,
        fixAndroidTouchableBug: PropTypes.bool,

        // Custom Modal props (iOS only)
        doneText: PropTypes.string,
        onDonePress: PropTypes.func,
        onUpArrow: PropTypes.func,
        onDownArrow: PropTypes.func,
        onClose: PropTypes.func,

        // Modal props (iOS only)
        modalProps: PropTypes.shape({}),

        // TextInput props
        textInputProps: PropTypes.shape({}),

        // Picker props
        pickerProps: PropTypes.shape({}),

        // Touchable Done props (iOS only)
        touchableDoneProps: PropTypes.shape({}),

        // Touchable wrapper props
        touchableWrapperProps: PropTypes.shape({}),

        // Custom Icon
        Icon: PropTypes.func,
        InputAccessoryView: PropTypes.func,

        // The width of the item picker for each wheel
        itemWidth: PropTypes.array,

        // The width of the item picker label for each wheel
        labelWidth: PropTypes.array,

        // A function to return the current picker value as a string
        valueToString: PropTypes.func,

        // Use date picker
        useDatePicker: PropTypes.bool,
        dateFormat: PropTypes.string,
    };

    static defaultProps = {
        value: undefined,
        placeholder: {
            label: 'Select an item...',
            value: null,
            color: '#9EA0A4',
        },
        disabled: false,
        itemKey: null,
        style: {},
        children: null,
        useNativeAndroidPickerStyle: true,
        useDatePicker: false,
        dateFormat: 'M/D/YYYY',
        fixAndroidTouchableBug: false,
        doneText: 'Done',
        onDonePress: null,
        onUpArrow: null,
        onDownArrow: null,
        onOpen: null,
        onClose: null,
        modalProps: {},
        textInputProps: {},
        pickerProps: {},
        touchableDoneProps: {},
        touchableWrapperProps: {},
        Icon: null,
        InputAccessoryView: null,
        itemWidth: null,
        valueToString: null,
    };

    static handlePlaceholder({ items, placeholder }) {
        items.forEach((i, idx) => {
            if (!isEqual(placeholder[idx], {})) {
                i.splice(0, placeholder[idx]);
            }
        });
        return items;
    }

    static isDate(obj) {
        return Object.prototype.toString.call(obj) === "[object Date]";
    };

    static getSelectedItem({ items, key, value }) {
        items = Array.isArray(items[0]) ? items : [items];
        key = key && Array.isArray(key[0]) ? key : [key];
        value = value && Array.isArray(items[0]) ? value : [value];

        if (!RNPickerSelect.isDate(value)) {
            // One selectedItem/idx entry per wheel.
            // selectedItem is an array of picker items; [{label:la,value:va},{label:lb,value:vb}...]
            // idx is an array of item indices corresponding 1:1 with selectedItems. selectedItem[0] has an
            // index of idx[0], selectedItem[1] of idx[1], etc.
            selectedItem = [];
            idx = [];
            const oneWheel = items.length === 1;
            for (let wheelIndex = 0; wheelIndex < items.length; wheelIndex++) {
                let itemIndex = items[wheelIndex].findIndex((item) => {
                    if (item.key && key) {
                        return isEqual(item.key, oneWheel ? key : key[wheelIndex]);
                    }
                    return isEqual(item.value, oneWheel ? value : value[wheelIndex]);
                });
                if (itemIndex === -1) {
                    itemIndex = 0;
                }

                selectedItem.push(items[wheelIndex][itemIndex] || {});
                idx.push(itemIndex);
            }
            return {
                selectedItem,
                idx,
            };
        } else {
            return {
                selectedItem: [{
                    color: null,
                    label: null,
                    value: value || new Date()
                }]
            };

        }
    }

    constructor(props) {
        super(props);

        // Backward compatibility
        //   Create array wrapper for single wheel. Calling component may use a single element
        //   array or a simple object if using one wheel.
        let items = props.items;
        if (!Array.isArray(items[0])) {
            items = [items];
        }
        let placeholder = props.placeholder;
        if (!Array.isArray(placeholder)) {
            placeholder = [placeholder];
        }

        items = RNPickerSelect.handlePlaceholder({
            items,
            placeholder: placeholder,
        });

        const { selectedItem } = RNPickerSelect.getSelectedItem({
            items,
            key: props.itemKey,
            value: props.value,
        });

        this.state = {
            items,
            labels: props.labels,
            selectedItem,
            showPicker: false,
            animationType: undefined,
            orientation: 'portrait',
            doneDepressed: false,
            itemWidth: props.itemWidth || new Array(items.length).fill(100 / items.length + '%'),
            labelWidth: props.labelWidth || new Array(items.length).fill(0)
        };

        this.onUpArrow = this.onUpArrow.bind(this);
        this.onDownArrow = this.onDownArrow.bind(this);
        this.onDateValueChange = this.onDateValueChange.bind(this);
        this.onValueChange = this.onValueChange.bind(this);
        this.onOrientationChange = this.onOrientationChange.bind(this);
        this.setInputRef = this.setInputRef.bind(this);
        this.togglePicker = this.togglePicker.bind(this);
        this.renderInputAccessoryView = this.renderInputAccessoryView.bind(this);
    }

    componentDidUpdate = (prevProps, prevState) => {
        // update items if items or placeholder prop changes
        const items = RNPickerSelect.handlePlaceholder({
            placeholder: this.props.placeholder,
        }).concat(this.props.items);
        const itemsChanged = !isEqual(prevState.items, items);

        // update selectedItem if value prop is defined and differs from currently selected item
        const { selectedItem, idx } = RNPickerSelect.getSelectedItem({
            items,
            key: this.props.itemKey,
            value: this.props.value,
        });
        const selectedItemChanged =
            !isEqual(this.props.value, undefined) && !isEqual(prevState.selectedItem, selectedItem);

        if (itemsChanged || selectedItemChanged) {
            this.props.onValueChange(selectedItem.value, idx);

            this.setState({
                ...(itemsChanged ? { items } : {}),
                ...(selectedItemChanged ? { selectedItem } : {}),
            });
        }
    };

    onUpArrow() {
        const { onUpArrow } = this.props;

        this.togglePicker(false, onUpArrow);
    }

    onDownArrow() {
        const { onDownArrow } = this.props;

        this.togglePicker(false, onDownArrow);
    }

    onValueChange(wheelIndex, value, index) {
        const { onValueChange } = this.props;
        const { selectedItem } = this.state;

        this.setState((prevState) => {
            selectedItem[wheelIndex] = prevState.items[wheelIndex][index];
            return {
                selectedItem,
            };
        }, () => {
            // The picker value is an array of value across each of the wheels.
            let value = selectedItem.map(item => {
                return item.value;
            });

            // Get value indices.
            let index = [];
            value.forEach((val, wheelIndex) => {
                const idx = this.state.items[wheelIndex].findIndex(el => el.value === val);
                index.push(idx);
            });

            // Backward compatibility
            //   Return a simple object if only one wheel is used.
            if (this.state.items.length === 1) {
                value = value[0];
                index = index[0];
            }
            onValueChange(value, index);
        });
    }

    onDateValueChange(event, value) {
        const { onValueChange } = this.props;

        onValueChange(value);

        this.setState((prevState) => {
            let si = Object.assign({}, prevState.selectedItem);
            si.value = value;
            return {
                selectedItem: si,
            };
        });
    }

    onOrientationChange({ nativeEvent }) {
        this.setState({
            orientation: nativeEvent.orientation,
        });
    }

    setInputRef(ref) {
        this.inputRef = ref;
    }

    getPlaceholderStyle() {
        const { placeholder, style } = this.props;
        const { selectedItem } = this.state;

        if (!isEqual(placeholder, {}) && selectedItem.label === placeholder.label) {
            return {
                ...defaultStyles.placeholder,
                ...style.placeholder,
            };
        }
        return {};
    }

    triggerOpenCloseCallbacks() {
        const { onOpen, onClose } = this.props;
        const { showPicker } = this.state;

        if (!showPicker && onOpen) {
            onOpen();
        }

        if (showPicker && onClose) {
            onClose();
        }
    }

    togglePicker(animate = false, postToggleCallback) {
        const { modalProps, disabled } = this.props;
        const { showPicker } = this.state;

        if (disabled) {
            return;
        }

        if (!showPicker) {
            Keyboard.dismiss();
        }

        const animationType =
            modalProps && modalProps.animationType ? modalProps.animationType : 'slide';

        this.triggerOpenCloseCallbacks();

        this.setState(
            (prevState) => {
                return {
                    animationType: animate ? animationType : undefined,
                    showPicker: !prevState.showPicker,
                };
            },
            () => {
                if (postToggleCallback) {
                    postToggleCallback();
                }
            }
        );
    }

    renderPickerItems(wheelIndex) {
        let { items } = this.state;

        items = [].concat(items[wheelIndex]);

        return items.map((item) => {
            return (
                <Picker.Item
                    label={item.label}
                    value={item.value}
                    key={item.key || item.label}
                    color={item.color}
                />
            );
        });
    }

    renderPickerLabel(wheelIndex) {
        let { labels } = this.state;

        if (labels[wheelIndex]) {
            return (
                <View style={{
                    position: 'absolute',
                    justifyContent: 'center',
                    top: '50%',
                    marginTop: -10,
                }}>
                    <Text style={{
                        fontSize: 20,
                        fontFamily: Platform.OS === 'ios' ? 'AppleSDGothicNeo-Light' : 'system font',
                    }}>
                        {labels[wheelIndex]}
                    </Text>
                </View>
            );
        }
    }

    renderInputAccessoryView() {
        const {
            InputAccessoryView,
            doneText,
            onUpArrow,
            onDownArrow,
            onDonePress,
            style,
            touchableDoneProps,
        } = this.props;

        const { doneDepressed } = this.state;

        if (InputAccessoryView) {
            return <InputAccessoryView testID="custom_input_accessory_view" />;
        }

        return (
            <View
                style={[defaultStyles.modalViewMiddle, style.modalViewMiddle]}
                testID="input_accessory_view"
            >
                <View style={[defaultStyles.chevronContainer, style.chevronContainer]}>
                    <TouchableOpacity
                        activeOpacity={onUpArrow ? 0.5 : 1}
                        onPress={onUpArrow ? this.onUpArrow : null}
                    >
                        <View
                            style={[
                                defaultStyles.chevron,
                                style.chevron,
                                defaultStyles.chevronUp,
                                style.chevronUp,
                                onUpArrow ? [defaultStyles.chevronActive, style.chevronActive] : {},
                            ]}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={onDownArrow ? 0.5 : 1}
                        onPress={onDownArrow ? this.onDownArrow : null}
                    >
                        <View
                            style={[
                                defaultStyles.chevron,
                                style.chevron,
                                defaultStyles.chevronDown,
                                style.chevronDown,
                                onDownArrow
                                    ? [defaultStyles.chevronActive, style.chevronActive]
                                    : {},
                            ]}
                        />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity
                    testID="done_button"
                    onPress={() => {
                        this.togglePicker(true, onDonePress);
                    }}
                    onPressIn={() => {
                        this.setState({ doneDepressed: true });
                    }}
                    onPressOut={() => {
                        this.setState({ doneDepressed: false });
                    }}
                    hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
                    {...touchableDoneProps}
                >
                    <View testID="needed_for_touchable">
                        <Text
                            testID="done_text"
                            allowFontScaling={false}
                            style={[
                                defaultStyles.done,
                                style.done,
                                doneDepressed
                                    ? [defaultStyles.doneDepressed, style.doneDepressed]
                                    : {},
                            ]}
                        >
                            {doneText}
                        </Text>
                    </View>
                </TouchableOpacity>
            </View>
        );
    }

    renderIcon() {
        const { style, Icon } = this.props;

        if (!Icon) {
            return null;
        }

        return (
            <View
                testID="icon_container"
                style={[defaultStyles.iconContainer, style.iconContainer]}
            >
                <Icon testID="icon" />
            </View>
        );
    }

    renderTextInputOrChildren() {
        const { children, style, textInputProps, valueToString, dateFormat, useDatePicker } = this.props;
        const { selectedItem } = this.state;

        const containerStyle =
            Platform.OS === 'ios' ? style.inputIOSContainer : style.inputAndroidContainer;

        if (children) {
            return (
                <View pointerEvents="box-only" style={containerStyle}>
                    {children}
                </View>
            );
        }

        // Create the displayed label by concatenating values across all wheels.
        let label = '';
        if (!useDatePicker) {
            if (!valueToString) {
                selectedItem.forEach(i => {
                if (label.length > 0) {
                    label += ' ';
                }
                    label += i.inputLabel || i.label;
                });
            } else {
                label = valueToString(selectedItem);
            }
        } else {
            label = moment(selectedItem[0].value).format(dateFormat);
        }
                
       return (
            <View pointerEvents="box-only" style={containerStyle}>
                <TextInput
                    testID="text_input"
                    style={[
                        Platform.OS === 'ios' ? style.inputIOS : style.inputAndroid,
                        this.getPlaceholderStyle(),
                    ]}
                    value={label}
                    ref={this.setInputRef}
                    editable={false}
                    {...textInputProps}
                />
                {this.renderIcon()}
            </View>
        );
    }

    renderIOS() {
        const { style, modalProps, pickerProps, touchableWrapperProps, useDatePicker } = this.props;
        const { animationType, orientation, selectedItem, showPicker, items, itemWidth, labelWidth } = this.state;

        return (
            <View style={[defaultStyles.viewContainer, style.viewContainer]}>
                <TouchableOpacity
                    testID="ios_touchable_wrapper"
                    onPress={() => {
                        this.togglePicker(true);
                    }}
                    activeOpacity={1}
                    {...touchableWrapperProps}
                >
                    {this.renderTextInputOrChildren()}
                </TouchableOpacity>
                <Modal
                    testID="ios_modal"
                    visible={showPicker}
                    transparent
                    animationType={animationType}
                    supportedOrientations={['portrait', 'landscape']}
                    onOrientationChange={this.onOrientationChange}
                    {...modalProps}
                >
                    <TouchableOpacity
                        style={[defaultStyles.modalViewTop, style.modalViewTop]}
                        testID="ios_modal_top"
                        onPress={() => {
                            this.togglePicker(true);
                        }}
                    />
                    {this.renderInputAccessoryView()}
                    <View
                        style={[
                            defaultStyles.modalViewBottom,
                            { height: orientation === 'portrait' ? 215 : 162 },
                            style.modalViewBottom,
                        ]}>
                        {useDatePicker
                        ? 
                            <DateTimePicker
                                testID="ios_date_picker"
                                onChange={this.onDateValueChange}
                                value={selectedItem[0].value}
                                {...pickerProps}
                            />
                        :
                        <View style={[{justifyContent: 'center'}]}>
                            <View style={[
                                defaultStyles.pickerContainer,
                                {flexDirection: 'row', justifyContent: 'center'},
                                style.pickerContainer
                            ]}>
                                {items.map((wheel, wheelIndex) => {
                                    let iWidth = itemWidth[wheelIndex];
                                    if (typeof iWidth === 'string') {
                                        iWidth = parseFloat(iWidth) / 100 * Dimensions.get('window').width;
                                    }
                                    let lWidth = labelWidth[wheelIndex];
                                    if (typeof lWidth === 'string') {
                                        lWidth = parseFloat(lWidth) / 100;
                                    }
                                    const tWidth = iWidth + lWidth;
                                    return (
                                        <View style={{width: tWidth, flexDirection: 'row', justifyContent: 'center'}}>
                                            <View style={{width: iWidth}}>
                                                <Picker
                                                    testID="ios_picker"
                                                    onValueChange={(value, index) => this.onValueChange(wheelIndex, value, index)}
                                                    selectedValue={selectedItem[wheelIndex].value}
                                                    {...pickerProps}
                                                >
                                                    {this.renderPickerItems(wheelIndex)}
                                                </Picker>
                                            </View>
                                            <View style={{width: lWidth}}>
                                                {this.renderPickerLabel(wheelIndex)}
                                            </View>
                                        </View>
                                    )}
                                )}
                            </View>
                        </View>
                        }
                    </View>
                </Modal>
            </View>
        );
    }

    renderAndroidHeadless() {
        const {
            disabled,
            Icon,
            style,
            pickerProps,
            onOpen,
            touchableWrapperProps,
            useDatePicker,
            fixAndroidTouchableBug,
        } = this.props;
        const { selectedItem, itemWidth, labelWidth } = this.state;

        const Component = fixAndroidTouchableBug ? View : TouchableOpacity;
        return (
            <Component
                testID="android_touchable_wrapper"
                onPress={onOpen}
                activeOpacity={1}
                {...touchableWrapperProps}
            >
                <View style={style.headlessAndroidContainer}>
                    {this.renderTextInputOrChildren()}
                    {useDatePicker
                    ?
                        <DateTimePicker
                            testID="android_date_picker_headless"
                            onChange={this.onDateValueChange}
                            value={selectedItem[0].value}
                            {...pickerProps}
                        />
                    :
                    <View style={[{justifyContent: 'center'}]}>
                        <View style={[{flexDirection: 'row', justifyContent: 'center',paddingLeft: 0}]}>
                            {items.map((wheel, wheelIndex) => {
                                let iWidth = itemWidth[wheelIndex];
                                if (typeof iWidth === 'string') {
                                    iWidth = parseFloat(iWidth) / 100 * Dimensions.get('window').width;
                                }
                                let lWidth = labelWidth[wheelIndex];
                                if (typeof lWidth === 'string') {
                                    lWidth = parseFloat(lWidth) / 100;
                                }
                                const tWidth = iWidth + lWidth;
                                return (
                                    <View style={{width: tWidth, flexDirection: 'row', justifyContent: 'center'}}>
                                        <View style={{width: iWidth}}>
                                            <Picker
                                                style={[
                                                    Icon ? { backgroundColor: 'transparent' } : {}, // to hide native icon
                                                    defaultStyles.headlessAndroidPicker,
                                                    style.headlessAndroidPicker,
                                                ]}
                                                testID="android_picker_headless"
                                                enabled={!disabled}
                                                onValueChange={(value, index) => this.onValueChange(wheelIndex, value, index)}
                                                selectedValue={selectedItem[wheelIndex].value}
                                                {...pickerProps}
                                            >
                                                {this.renderPickerItems(wheelIndex)}
                                            </Picker>
                                        </View>
                                        <View style={{width: lWidth}}>
                                            {this.renderPickerLabel(wheelIndex)}
                                        </View>
                                    </View>
                                )}
                            )}
                        </View>
                    </View>
                    }
                </View>
            </Component>
        );
    }

    renderAndroidNativePickerStyle() {
        const { disabled, Icon, style, pickerProps, useDatePicker } = this.props;
        const { selectedItem, itemWidth, labelWidth } = this.state;

        return (
            <View style={[defaultStyles.viewContainer, style.viewContainer]}>
                {useDatePicker
                ?
                    <DateTimePicker
                        testID="android_date_picker_headless"
                        onChange={this.onDateValueChange}
                        value={selectedItem[0].value}
                        {...pickerProps}
                    />
                :
                <View style={[{justifyContent: 'center'}]}>
                    <View style={[{flexDirection: 'row', justifyContent: 'center',paddingLeft: 0}]}>
                        {items.map((wheel, wheelIndex) => {
                            let iWidth = itemWidth[wheelIndex];
                            if (typeof iWidth === 'string') {
                                iWidth = parseFloat(iWidth) / 100 * Dimensions.get('window').width;
                            }
                            let lWidth = labelWidth[wheelIndex];
                            if (typeof lWidth === 'string') {
                                lWidth = parseFloat(lWidth) / 100;
                            }
                            const tWidth = iWidth + lWidth;
                            return (
                                <View style={{width: tWidth, flexDirection: 'row', justifyContent: 'center'}}>
                                    <View style={{width: iWidth}}>
                                        <Picker
                                            style={[
                                                Icon ? { backgroundColor: 'transparent' } : {}, // to hide native icon
                                                style.inputAndroid,
                                                this.getPlaceholderStyle(),
                                            ]}
                                            testID="android_picker_headless"
                                            enabled={!disabled}
                                            onValueChange={(value, index) => this.onValueChange(wheelIndex, value, index)}
                                            selectedValue={selectedItem[wheelIndex].value}
                                            {...pickerProps}
                                        >
                                            {this.renderPickerItems(wheelIndex)}
                                        </Picker>
                                    </View>
                                    <View style={{width: lWidth}}>
                                        {this.renderPickerLabel(wheelIndex)}
                                    </View>
                                </View>
                            )}
                        )}
                    </View>
                </View>
                }
                {this.renderIcon()}
            </View>
        );
    }

    renderWeb() {
        const { disabled, style, pickerProps } = this.props;
        const { selectedItem, itemWidth } = this.state;

        return (
            <View style={[defaultStyles.viewContainer, style.viewContainer]}>
                <View style={[{justifyContent: 'center'}]}>
                    <View style={[{flexDirection: 'row', justifyContent: 'center',paddingLeft: 0}]}>
                    {items.map((wheel, wheelIndex) => {
                        return (
                            <View style={{width: itemWidth[wheelIndex]}}>
                                <Picker
                                    style={[style.inputWeb]}
                                    testID="web_picker"
                                    onValueChange={(value, index) => this.onValueChange(wheelIndex, value, index)}
                                    selectedValue={selectedItem[wheelIndex].value}
                                    {...pickerProps}
                                >
                                    {this.renderPickerItems(wheelIndex)}
                                </Picker>
                            </View>
                        )}
                    )}
                    </View>
                </View>
                {this.renderIcon()}
            </View>
        );
    }

    render() {
        const { children, useNativeAndroidPickerStyle } = this.props;

        if (Platform.OS === 'ios') {
            return this.renderIOS();
        }

        if (Platform.OS === 'web') {
            return this.renderWeb();
        }

        if (children || !useNativeAndroidPickerStyle) {
            return this.renderAndroidHeadless();
        }

        return this.renderAndroidNativePickerStyle();
    }
}

export { defaultStyles };
