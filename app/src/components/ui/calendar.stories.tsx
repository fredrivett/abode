"use client";

import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import type { DateRange, SelectSingleEventHandler } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";

const meta = {
  title: "UI/Calendar",
  component: Calendar,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Calendar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [selected, setSelected] = useState<Date | undefined>(new Date());

    return (
      <Calendar
        mode="single"
        selected={selected}
        onSelect={setSelected as SelectSingleEventHandler}
      />
    );
  },
};

export const WithDropdowns: Story = {
  render: () => {
    const [selected, setSelected] = useState<Date | undefined>(new Date());

    return (
      <Calendar
        mode="single"
        captionLayout="dropdown"
        selected={selected}
        onSelect={setSelected as SelectSingleEventHandler}
      />
    );
  },
};

export const RangeSelection: Story = {
  render: () => {
    const [selected, setSelected] = useState<DateRange | undefined>({
      from: new Date(),
      to: new Date(new Date().setDate(new Date().getDate() + 7)),
    });

    return <Calendar mode="range" selected={selected} onSelect={setSelected} />;
  },
};

export const Disabled: Story = {
  render: () => {
    const [selected, setSelected] = useState<Date | undefined>(new Date());
    const disabledDates = (date: Date) => {
      const day = date.getDay();
      return day === 0 || day === 6; // Disable weekends
    };

    return (
      <Calendar
        mode="single"
        selected={selected}
        onSelect={setSelected as SelectSingleEventHandler}
        disabled={disabledDates}
      />
    );
  },
};

export const MultipleMonth: Story = {
  render: () => {
    const [selected, setSelected] = useState<DateRange | undefined>({
      from: new Date(),
    });

    return (
      <Calendar
        mode="range"
        numberOfMonths={2}
        selected={selected}
        onSelect={setSelected}
      />
    );
  },
};
