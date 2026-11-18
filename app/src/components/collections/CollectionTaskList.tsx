import { Fragment } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskList } from '../TaskList';
import { SectionHeader } from '../SectionHeader';
import { PlaceholderBullet } from '../ui/PlaceholderBullet';
import { EditableText } from '../ui/EditableText';
import { InlineNameInput } from '../ui/InlineNameInput';
import { useI18n } from '../../i18n/I18nContext';
import type { CollectionTaskListProps } from '../../types/collections';

export function CollectionTaskList({
  collectionId, inputRef, taskListProps, onTaskToggle, topLevelGroup,
  input: { input, setInput, sectionTaskInput, setSectionTaskInput,
    handleAddAtEnd, handleAddSectionTask, handleAddNoteKeyDown },
  sections: { sectionGroups, editingSectionId, addingSection, setEditingSectionId,
    handleAddSection, handleDeleteSection, handleCommitSectionName,
    handleCancelSectionEdit, handleSectionRightClick },
}: CollectionTaskListProps) {
  const { t } = useI18n();
  return (
    <>
      <div className="h-6" />

      <TaskList
        tasks={topLevelGroup.tasks}
        containerId={`collection:${collectionId}`}
        onTaskToggle={onTaskToggle}
        {...taskListProps}
      />

      <div className="flex items-start min-h-6">
        <PlaceholderBullet />
        <EditableText
          ref={inputRef}
          value={input}
          onValueChange={setInput}
          onEnter={handleAddAtEnd}
          onBlur={() => handleAddAtEnd(input)}
          onKeyDown={handleAddNoteKeyDown}
          placeholder={t('common.addTask')}
          aria-label={t('common.addTask')}
          className="task-input task-add-input flex-1 text-sm leading-6 text-ink bg-transparent border-none outline-none p-0"
          spellCheck={false}
        />
      </div>

      <SortableContext
        items={sectionGroups.map((group) => group.section!.id)}
        strategy={verticalListSortingStrategy}
      >
        {sectionGroups.map((group) => (
          <Fragment key={group.section!.id}>
            <div className="h-6" />
            <SectionHeader
              section={group.section!}
              collectionId={collectionId}
              isEditing={editingSectionId === group.section!.id}
              onEdit={() => setEditingSectionId(group.section!.id)}
              onCommitName={(name) => handleCommitSectionName(group.section!.id, name)}
              onCancelEdit={() => handleCancelSectionEdit(group.section!.id)}
              onDelete={() => handleDeleteSection(group.section!.id)}
              onRightClick={(position) => handleSectionRightClick(group.section!.id, position)}
            />
            <TaskList
              tasks={group.tasks}
              containerId={`section:${group.section!.id}`}
              sectionId={group.section!.id}
              collectionId={collectionId}
              onTaskToggle={onTaskToggle}
              {...taskListProps}
            />
            <div className="flex items-start min-h-6">
              <PlaceholderBullet />
              <EditableText
                value={sectionTaskInput[group.section!.id] ?? ''}
                onValueChange={(text) =>
                  setSectionTaskInput((prev) => ({ ...prev, [group.section!.id]: text }))
                }
                onEnter={(text) => handleAddSectionTask(group.section!.id, text)}
                onBlur={() =>
                  handleAddSectionTask(group.section!.id, sectionTaskInput[group.section!.id] ?? '')
                }
                placeholder={t('common.addTask')}
                aria-label={t('common.addTask')}
                className="task-input task-add-input flex-1 text-sm leading-6 text-ink bg-transparent border-none outline-none p-0"
                spellCheck={false}
              />
            </div>
          </Fragment>
        ))}
      </SortableContext>

      <div className="h-6" />

      {addingSection ? (
        <div className="flex h-6 w-full min-w-0 items-center pr-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-light opacity-35">+</span>
          <InlineNameInput
            defaultValue=""
            placeholder={t('page.newSection')}
            className="uppercase tracking-widest text-[10px] font-semibold text-ink-light"
            onCommit={(name) => handleCommitSectionName(addingSection.id, name)}
            onCancel={() => handleCancelSectionEdit(addingSection.id)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={handleAddSection}
          className="group flex h-6 w-full min-w-0 items-center pr-2 text-ink-light opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center">+</span>
          <span className="min-w-0 flex-1 truncate text-left uppercase tracking-widest text-[10px] font-semibold">
            {t('page.newSection')}
          </span>
        </button>
      )}
    </>
  );
}
