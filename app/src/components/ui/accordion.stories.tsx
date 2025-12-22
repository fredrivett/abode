import type { Meta, StoryObj } from "@storybook/react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function SingleAccordion() {
  return (
    <Accordion type="single" collapsible className="w-[400px]">
      <AccordionItem value="item-1">
        <AccordionTrigger>Is it accessible?</AccordionTrigger>
        <AccordionContent>
          Yes. It adheres to the WAI-ARIA design pattern.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Is it styled?</AccordionTrigger>
        <AccordionContent>
          Yes. It comes with default styles that matches the other components'
          aesthetic.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>Is it animated?</AccordionTrigger>
        <AccordionContent>
          Yes. It's animated by default, but you can disable it if you prefer.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function MultipleAccordion() {
  return (
    <Accordion type="multiple" className="w-[400px]">
      <AccordionItem value="item-1">
        <AccordionTrigger>First section</AccordionTrigger>
        <AccordionContent>
          Content for the first section. Multiple items can be open at once.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Second section</AccordionTrigger>
        <AccordionContent>
          Content for the second section. Try opening multiple items.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function DefaultOpenAccordion() {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="item-1"
      className="w-[400px]"
    >
      <AccordionItem value="item-1">
        <AccordionTrigger>Open by default</AccordionTrigger>
        <AccordionContent>
          This accordion item is open by default using the defaultValue prop.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Closed by default</AccordionTrigger>
        <AccordionContent>This one starts closed.</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

const meta = {
  title: "UI/Accordion",
  component: SingleAccordion,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof SingleAccordion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Single: Story = {};

export const Multiple: Story = {
  render: () => <MultipleAccordion />,
};

export const DefaultOpen: Story = {
  render: () => <DefaultOpenAccordion />,
};
