import React from 'react';
import StoryComment from './StoryComment';
import SingleReactor from './SingleReactor';
import CommentSkeleton from '../loading/CommentSkeleton';

const StoryEngagementPanel = ({
    story,
    activePanel,
    onPanelChange,
    commentCount = 0,
    allComments,
    setAllComments,
    setTotalComments,
    myProfile,
    myId,
    panelRef,
}) => {
    const reacts = Array.isArray(story?.reacts) ? story.reacts.filter(Boolean) : [];
    const reactCount = reacts.length;
    const isComments = activePanel === 'comments';

    return (
        <aside
            ref={panelRef}
            className="story-engagement-panel"
            aria-label="Story reacts and comments"
        >
            <div className="story-engagement-tabs" role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={isComments}
                    className={`story-engagement-tab ${isComments ? 'is-active' : ''}`}
                    onClick={() => onPanelChange('comments')}
                >
                    <i className="fa fa-comments" aria-hidden="true" />
                    <span>Comments</span>
                    <span className="story-engagement-tab-count">{commentCount}</span>
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={!isComments}
                    className={`story-engagement-tab ${!isComments ? 'is-active' : ''}`}
                    onClick={() => onPanelChange('reacts')}
                >
                    <i className="fa fa-heart" aria-hidden="true" />
                    <span>Reacts</span>
                    <span className="story-engagement-tab-count">{reactCount}</span>
                </button>
            </div>

            {isComments ? (
                <div
                    id="story-comments"
                    className="story-engagement-body story-engagement-comments"
                    role="tabpanel"
                >
                    <StoryComment
                        story={story}
                        commentState={setTotalComments}
                        allComments={allComments}
                        setAllComments={setAllComments}
                        myProfile={myProfile}
                        authProfile={myId}
                        authProfilePicture={myProfile?.profilePic}
                    />
                </div>
            ) : (
                <div className="story-engagement-body story-engagement-reacts" role="tabpanel">
                    {reactCount === 0 ? (
                        <div className="story-comments-empty">No reacts yet</div>
                    ) : (
                        <ul className="story-reacts-list story-engagement-reacts-list">
                            {reacts.map((item, index) => (
                                <SingleReactor
                                    reactor={item}
                                    key={`${item.profile || item._id || index}-${item.type || 'react'}`}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </aside>
    );
};

export const StoryEngagementSkeleton = () => (
    <aside className="story-engagement-panel story-engagement-skeleton" aria-hidden="true">
        <div className="story-engagement-tabs">
            <span className="ss-skeleton-line title" />
            <span className="ss-skeleton-line title" />
        </div>
        <div className="story-engagement-body">
            <CommentSkeleton count={3} />
            <div className="ss-skeleton-composer">
                <span className="ss-skeleton-avatar small" />
                <span className="ss-skeleton-input" />
            </div>
        </div>
    </aside>
);

export default StoryEngagementPanel;
