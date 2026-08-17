'use client';
import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { tva } from '@gluestack-ui/utils/nativewind-utils';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';

const inputStyle = tva({
  base: 'h-9 w-full flex-row items-center rounded-md border border-border dark:bg-input/30 bg-transparent shadow-xs overflow-hidden px-3 gap-2',
});

const inputIconStyle = tva({
  base: 'justify-center items-center text-muted-foreground fill-none h-4 w-4',
});

const inputSlotStyle = tva({
  base: 'justify-center items-center web:disabled:cursor-not-allowed',
});

const inputFieldStyle = tva({
  base: 'flex-1 text-foreground text-sm md:text-sm py-1 h-full placeholder:text-muted-foreground web:outline-none ios:leading-[0px] web:cursor-text web:data-[disabled=true]:cursor-not-allowed',
});

type IInputProps = React.ComponentPropsWithoutRef<typeof View> &
  VariantProps<typeof inputStyle> & { className?: string };
const Input = React.forwardRef<React.ComponentRef<typeof View>, IInputProps>(
  function Input({ className, ...props }, ref) {
    return (
      <View
        ref={ref}
        {...props}
        className={inputStyle({ class: className })}
      />
    );
  }
);

type IInputIconProps = React.ComponentPropsWithoutRef<typeof View> &
  VariantProps<typeof inputIconStyle> & {
    className?: string;
  };

const InputIcon = React.forwardRef<
  React.ComponentRef<typeof View>,
  IInputIconProps
>(function InputIcon({ className, ...props }, ref) {
  return (
    <View
      ref={ref}
      {...props}
      className={inputIconStyle({ class: className })}
    />
  );
});

type IInputSlotProps = React.ComponentPropsWithoutRef<typeof Pressable> &
  VariantProps<typeof inputSlotStyle> & { className?: string };

const InputSlot = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  IInputSlotProps
>(function InputSlot({ className, ...props }, ref) {
  return (
    <Pressable
      ref={ref}
      {...props}
      className={inputSlotStyle({
        class: className,
      })}
    />
  );
});

type IInputFieldProps = React.ComponentPropsWithoutRef<typeof TextInput> &
  VariantProps<typeof inputFieldStyle> & { className?: string };

const InputField = React.forwardRef<
  React.ComponentRef<typeof TextInput>,
  IInputFieldProps
>(function InputField({ className, ...props }, ref) {
  return (
    <TextInput
      ref={ref}
      {...props}
      className={inputFieldStyle({
        class: className,
      })}
    />
  );
});

Input.displayName = 'Input';
InputIcon.displayName = 'InputIcon';
InputSlot.displayName = 'InputSlot';
InputField.displayName = 'InputField';

export { Input, InputField, InputIcon, InputSlot };
