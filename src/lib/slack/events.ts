import {SlackConnection, ISlackAckResponse, SlackEventList, SlackPayload} from "@nexus-switchboard/nexus-conn-slack";
import {findNestedProperty, findProperty} from "@nexus-switchboard/nexus-extend";
import moduleInstance, {logger} from "../..";
import ServiceRequest from "../../lib/request";

/**
 * General handler for thread posts made in threads that are part of an open request.
 * @param _conn
 * @param slackParams The params past to the event handler
 */
const handlePostedThreadMessage = async (_conn: SlackConnection,
                                         slackParams: SlackPayload): Promise<ISlackAckResponse> => {

    const config = moduleInstance.getActiveModuleConfig();

    // ignore any message that is posted by a bot.
    if (!ServiceRequest.isBotMessage(slackParams.message || slackParams, config.SLACK_BOT_USERNAME)) {

        // then see if this is associated with a request ticket.
        const channel = findProperty(slackParams, "channel");
        const messageTs = findProperty(slackParams, "ts");
        const threadTs = findProperty(slackParams, "thread_ts");
        const slackUserId = findNestedProperty(slackParams, "user", "id");

        // first determine if this is a threaded message.  If it's not there's nothing to do.
        if (threadTs && threadTs !== messageTs) {

            // note that we don't block on requests in the main flow because slack is expecting a response of some
            //  kind within a very short period.
            ServiceRequest.loadThreadFromSlackEvent(slackUserId, channel, threadTs)
                .then(async (request: ServiceRequest) => {
                    return await request.addCommentFromMessageEvent(slackParams);
                })
                .catch((e) => {
                    logger("Exception thrown: Unable to send comment to Jira: " + e.toString());
                });
        }
    }

    return {
        code: 200
    };

};

export const events: SlackEventList = {
    message: async (conn: SlackConnection, slackParams: SlackPayload): Promise<ISlackAckResponse> => {
        return handlePostedThreadMessage(conn, slackParams);
    }
};
